// GALLEY (z 8..14, port): composes dinette/window seat, coffee machine, plant, aft kitchen units, and builds the corridor-side counter run
// (coffee station, sink + tap, hob + hood), upper cupboards, utensil rail, ceiling lights. EURYDICE: cupboards hang open with ration packets.
import dining from './crew_dining.js';
import coffee from './crew_coffee.js';
import galley2 from './crew_galley2.js';
import { Frame } from './crew_util.js';

export default function galley(kit) {
  const eur = kit.eur, PI = Math.PI, FL = -1.2, CE = 1.35, CT = -0.3;           // CT = counter top
  dining(kit);
  coffee(kit, -1.5, CT, 11.38);
  galley2(kit);

  // corridor-side counter run x −1.82..−1.27, z 10.92..13.3: carcass, dark fronts, wood top (with sink opening)
  const Z0 = 10.92, Z1 = 13.3, XC = -1.545, K = new Frame(kit, [XC, 0, (Z0 + Z1) / 2]), L = Z1 - Z0;
  K.box('trim', [-0.015, FL + 0.05, 0], [0.5, 0.1, L], { bev: 0.004 }); K.box('white', [0, -0.72, 0], [0.53, 0.76, L], { bev: 0.01 });
  kit.colBox([XC, FL + 0.45, (Z0 + Z1) / 2], [0.55, 0.9, L]);
  const top = (x0, x1, z0, z1) => kit.box('wood', [(x0 + x1) / 2, CT - 0.02, (z0 + z1) / 2], [x1 - x0, 0.04, z1 - z0], { bev: 0.006 });
  top(-1.82, -1.27, Z0, 11.95); top(-1.82, -1.74, 11.95, 12.45); top(-1.36, -1.27, 11.95, 12.45); top(-1.74, -1.36, 11.95, 12.0); top(-1.74, -1.36, 12.42, 12.45); top(-1.82, -1.27, 12.45, Z1);
  kit.box('trim', [-1.826, CT - 0.02, (Z0 + Z1) / 2], [0.012, 0.046, L], { bev: 0.003 });
  const front = (z0, z1, y0, y1, handleV) => {                                  // dark cupboard / drawer front on the −x face
    kit.box('plasticDark', [-1.8125, (y0 + y1) / 2, (z0 + z1) / 2], [0.015, y1 - y0, z1 - z0 - 0.012], { bev: 0.004 });
    kit.box('metal', [-1.828, handleV ? (y0 + y1) / 2 : y1 - 0.06, (z0 + z1) / 2 + (handleV ? (z1 - z0) / 2 - 0.05 : 0)], handleV ? [0.016, 0.2, 0.016] : [0.016, 0.014, 0.2], { bev: 0.004 });
  };
  front(Z0, 11.36, -1.1, -0.34, true); front(11.36, 11.8, -1.1, -0.34, true); front(11.8, 12.2, -1.1, -0.34, true); front(12.2, 12.65, -1.1, -0.34, true);
  [[-0.5, -0.34], [-0.7, -0.5], [-0.9, -0.7]].forEach(([y0, y1]) => front(12.65, Z1, y0 - 0.0, y1 - 0.0, false));
  kit.box('paintOrange', [-1.822, -0.355, (Z0 + Z1) / 2], [0.006, 0.014, L], { bev: 0 });
  // sink basin + tap + drainer rack
  const SB = new Frame(kit, [-1.55, CT, 12.2]);
  SB.box('steel', [0, -0.22, 0], [0.38, 0.008, 0.5], { bev: 0 }); for (const s of [-1, 1]) { SB.box('steel', [s * 0.189, -0.15, 0], [0.008, 0.15, 0.5], { bev: 0 }); SB.box('steel', [0, -0.15, s * 0.249], [0.38, 0.15, 0.008], { bev: 0 }); }
  SB.cyl('plasticDark', [0, -0.213, 0], 0.03, 0.006, { seg: 12 });
  SB.tube('metal', [[0.22, 0, 0.0], [0.22, 0.2, 0.0], [0.2, 0.28, 0.0], [0.08, 0.27, 0.0], [0.0, 0.21, 0.0]], 0.011, { rseg: 8 }); SB.cyl('trim', [0.22, 0.01, 0], 0.025, 0.03, { seg: 12 });
  SB.box('metal', [0.26, 0.1, 0.04], [0.012, 0.012, 0.07], { bev: 0.003 });
  const R = new Frame(kit, [-1.55, CT, 11.88]);
  R.box('metal', [0, 0.012, 0], [0.34, 0.008, 0.12], { bev: 0 }); for (let k = 0; k < 4; k++) R.cyl(k % 2 ? 'paintWhite' : 'paintWhite', [-0.12 + k * 0.08, 0.075, 0], 0.075, 0.008, { axis: 'z', seg: 18 });
  if (!eur) R.cyl('paintCyan', [0.14, 0.05, 0.0], 0.03, 0.06, { rt: 0.034, rb: 0.026, seg: 12, rot: [PI, 0, 0] });
  // hob + pot + hood
  K.box('screenOff', [0.0, CT + 0.003, 12.98 - (Z0 + Z1) / 2], [0.46, 0.006, 0.56], { bev: 0.002 });
  for (const [x, z] of [[-0.09, -0.15], [0.09, 0.15], [0.09, -0.15], [-0.09, 0.15]]) { K.tor('trim', [x, CT + 0.008, 12.98 - (Z0 + Z1) / 2 + z], 0.05, 0.004, { seg: 18 }); K.tor(eur ? 'trim' : 'emitHot', [x, CT + 0.007, 12.98 - (Z0 + Z1) / 2 + z], 0.028, 0.0025, { seg: 14 }); }
  for (let k = 0; k < 4; k++) { kit.cyl('metal', [-1.832, -0.42, 12.74 + k * 0.17], 0.018, 0.02, { axis: 'x', seg: 12 }); kit.box('paintCyan', [-1.84, -0.4, 12.74 + k * 0.17], [0.004, 0.012, 0.004], { bev: 0 }); }
  if (!eur) { const Pt = new Frame(kit, [-1.64, CT, 12.83]); Pt.cyl('steel', [0, 0.075, 0], 0.1, 0.15, { seg: 20 }); Pt.cyl('trim', [0, 0.155, 0], 0.104, 0.012, { seg: 20 }); Pt.sph('trim', [0, 0.168, 0], 0.014, { seg: 8 }); for (const s of [-1, 1]) Pt.box('trim', [0, 0.12, s * 0.12], [0.022, 0.022, 0.05], { bev: 0.005 }); }
  kit.box('steel', [-1.43, 0.58, 12.98], [0.42, 0.12, 0.62], { bev: 0.01 }); kit.box('steel', [-1.34, 0.95, 12.98], [0.16, 0.7, 0.3], { bev: 0.008 }); kit.box(eur ? 'plasticDark' : 'emitWarm', [-1.43, 0.518, 12.98], [0.38, 0.004, 0.55], { bev: 0 });

  // upper cupboards (dark doors; EURYDICE: hanging open with rations inside)
  kit.box('white', [-1.445, 0.75, 11.7], [0.35, 0.9, 1.74], { bev: 0.01 });
  kit.box('emitWarm', [-1.5, 0.295, 11.7], [0.22, 0.008, 1.6], { bev: 0 });
  const upper = (zh, w, sgn, open) => {
    const H = new Frame(kit, [-1.62, 0.75, zh], open ? -sgn * 1.75 : 0), c = sgn * w / 2;
    H.box('plasticDark', [0, 0, c], [0.016, 0.88, w - 0.01], { bev: 0.004 }); H.box('metal', [-0.014, -0.3, c - sgn * (w / 2 - 0.06)], [0.016, 0.16, 0.016], { bev: 0.004 });
  };
  [[10.84, 0.56, 1], [11.42, 0.56, 1], [11.99, 0.56, 1]].forEach(([zh, w, s], i) => upper(zh + 0.0, w, s, eur && i !== 1));
  if (eur) {
    for (const [z, y] of [[11.3, 0.5], [11.95, 0.75], [11.3, 0.9]]) kit.box('metal', [-1.45, y - 0.2, z], [0.3, 0.012, 0.5], { bev: 0.002 });
    [['paintOrange', -1.45, 0.34, 11.2], ['paintCyan', -1.5, 0.34, 11.45], ['paintWhite', -1.42, 0.34, 11.95], ['paintOrange', -1.5, 0.54, 11.9]].forEach(([m, x, y, z]) => kit.box(m, [x, y, z], [0.1, 0.06, 0.14], { bev: 0.003, rot: [0.0, z, 0.1] }));
    for (let k = 0; k < 5; k++) kit.box(k % 2 ? 'paintOrange' : 'paintCyan', [-1.75 + k * 0.05, FL + 0.007 + (k % 2) * 0.0, 11.9 + k * 0.15 - (k % 3) * 0.2], [0.14, 0.014, 0.09], { bev: 0.003, rot: [0, k * 1.3, 0] });
  }

  // backsplash + utensil rail (above sink / hob) + wall clock-ish status plate
  kit.box('paintWhite', [-1.272, 0.0, 12.12], [0.012, 0.55, 2.35], { bev: 0.002 }); kit.box('paintCyan', [-1.264, 0.275, 12.12], [0.006, 0.014, 2.35], { bev: 0 });
  kit.beam('metal', [-1.3, 0.12, 11.95], [-1.3, 0.12, 13.2], 0.014, 0.014, { bev: 0.004 });
  const hang = (z, kind) => { const H = new Frame(kit, [-1.32, 0.12, z]); H.tube('metal', [[0, 0, 0], [-0.015, -0.012, 0], [-0.015, -0.03, 0]], 0.003, { rseg: 4 });
    if (kind === 0) { H.cyl('steel', [-0.015, -0.12, 0], 0.005, 0.18, { seg: 6 }); H.cyl('steel', [-0.015, -0.24, 0], 0.035, 0.012, { seg: 12, rt: 0.035, rb: 0.035 }); }
    else if (kind === 1) { H.cyl('steel', [-0.015, -0.11, 0], 0.005, 0.16, { seg: 6 }); H.box('plasticDark', [-0.015, -0.22, 0], [0.02, 0.07, 0.05], { bev: 0.006 }); }
    else if (kind === 2) { H.cyl('steel', [-0.015, -0.1, 0], 0.005, 0.14, { seg: 6 }); for (let k = -2; k <= 2; k++) H.cyl('metal', [-0.015, -0.2, k * 0.008], 0.002, 0.1, { seg: 4 }); }
    else { H.box('steel', [-0.015, -0.1, 0.0], [0.012, 0.18, 0.008], { bev: 0 }); H.box('steel', [-0.015, -0.1, 0.02], [0.012, 0.18, 0.008], { bev: 0 }); } };
  if (!eur) [12.05, 12.22, 12.42, 12.62, 12.82, 13.0].forEach((z, i) => hang(z, i % 4));
  else hang(12.2, 3);

  // floor mat in front of the counters + ceiling duct along the outer wall
  kit.box('rubber', [-2.16, FL + 0.006, 12.1], [0.68, 0.012, 2.2], { bev: 0.003 }); kit.box('paintOrange', [-2.5, FL + 0.007, 12.1], [0.012, 0.014, 2.2], { bev: 0 });
  kit.box('steel', [-3.82, CE - 0.11, 11.0], [0.2, 0.22, 5.7], { bev: 0.01 }); kit.box('paintCyan', [-3.718, CE - 0.14, 11.0], [0.004, 0.03, 5.7], { bev: 0 });
  for (const z of [8.6, 9.9, 11.2, 12.5, 13.5]) kit.box('trim', [-3.82, CE - 0.11, z], [0.23, 0.245, 0.05], { bev: 0.006 });
  // ceiling lights: kitchen + dinette (warm) with trim frames
  for (const [x, z, w, d] of [[-2.55, 12.5, 0.9, 0.5], [-2.9, 9.0, 0.8, 0.5]]) {
    kit.box('emitWarm', [x, CE - 0.008, z], [w, 0.016, d], { bev: 0 });
    for (const s of [-1, 1]) { kit.box('trim', [x, CE - 0.012, z + s * (d / 2 + 0.02)], [w + 0.1, 0.024, 0.04], { bev: 0.004 }); kit.box('trim', [x + s * (w / 2 + 0.02), CE - 0.012, z], [0.04, 0.024, d + 0.04], { bev: 0.004 }); }
  }
}
