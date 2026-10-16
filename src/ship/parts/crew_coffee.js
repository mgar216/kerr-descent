// GALLEY — espresso machine on the corridor-side counter (galley.coffee): body, group head + portafilter, steam wand, gauge, water tank, bean grinder, cups.
// Local frame: origin = counter top under the machine, front faces local −z. EURYDICE: dead machine, frozen cups, no indicators.
import { Frame } from './crew_util.js';

export default function coffee(kit, wx, wy, wz) {
  const eur = kit.eur, PI = Math.PI;
  const C = new Frame(kit, [wx, wy, wz], PI / 2);                                  // faces −x (into the galley)
  // base, drip tray, body
  C.box('steel', [0, 0.02, 0.0], [0.46, 0.04, 0.42], { bev: 0.008 });
  C.box('grate', [0, 0.044, -0.15], [0.34, 0.006, 0.1], { bev: 0 }); C.box('trim', [0, 0.026, -0.213], [0.36, 0.03, 0.014], { bev: 0.004 });
  C.box('steel', [0, 0.21, 0.07], [0.44, 0.34, 0.26], { bev: 0.014 });
  C.box('plasticDark', [0, 0.24, -0.066], [0.4, 0.27, 0.012], { bev: 0.004 }); C.box('paintOrange', [0, 0.092, -0.066], [0.4, 0.016, 0.014], { bev: 0.002 });
  C.box('trim', [0, 0.4, 0.06], [0.46, 0.024, 0.3], { bev: 0.008 }); C.box('metal', [0, 0.416, -0.07], [0.44, 0.012, 0.014], { bev: 0.004 });   // cup-warmer deck + rail
  // gauge, steam knob, buttons, indicators
  C.cyl('paintWhite', [-0.12, 0.31, -0.076], 0.042, 0.008, { axis: 'z', seg: 20 }); C.tor('metal', [-0.12, 0.31, -0.079], 0.042, 0.004, { axis: 'z', seg: 20 });
  C.box('trim', [-0.12, 0.318, -0.082], [0.004, 0.034, 0.002], { bev: 0, rot: [0, 0, eur ? 0 : -0.7] });
  C.cyl('metal', [0.15, 0.31, -0.084], 0.02, 0.024, { axis: 'z', seg: 14 }); C.box('trim', [0.15, 0.31, -0.098], [0.036, 0.008, 0.006], { bev: 0.002 });
  for (let k = 0; k < 3; k++) C.cyl('metal', [-0.09 + k * 0.055, 0.24, -0.077], 0.015, 0.012, { axis: 'z', seg: 12 });
  if (!eur) {
    C.tor('ledCyan', [0.0, 0.31, -0.078], 0.026, 0.004, { axis: 'z', seg: 20 }); C.box(kit.led('Green'), [0.0, 0.31, -0.079], [0.012, 0.012, 0.004], { bev: 0 });
    for (let k = 0; k < 3; k++) C.box(k === 1 ? kit.led('Amber', 'Blink') : kit.led('Green'), [-0.09 + k * 0.055, 0.215, -0.073], [0.018, 0.006, 0.004], { bev: 0 });
    C.box('ledAmber', [0.17, 0.2, -0.074], [0.03, 0.01, 0.004], { bev: 0 });
  }
  // group head + portafilter + spouts + cup
  C.cyl('metal', [0, 0.215, -0.1], 0.052, 0.06, { seg: 18 }); C.cyl('trim', [0, 0.18, -0.1], 0.046, 0.012, { seg: 18 });
  C.cyl('steel', [0, 0.166, -0.1], 0.04, 0.022, { seg: 16 }); C.cyl('plasticDark', [0, 0.166, -0.19], 0.014, 0.12, { axis: 'z', seg: 10 }); C.sph('plasticDark', [0, 0.166, -0.25], 0.017, { seg: 8 });
  for (const s of [-1, 1]) C.cyl('metal', [s * 0.014, 0.142, -0.1], 0.006, 0.03, { seg: 8 });
  C.cyl('paintWhite', [0, 0.085, -0.1], 0.036, 0.075, { rt: 0.042, rb: 0.032, seg: 16 }); C.cyl(eur ? 'crewIce' : 'rubber', [0, 0.1225, -0.1], 0.039, 0.003, { seg: 16 });
  C.tor('paintWhite', [0.0, 0.092, -0.1 - 0.052], 0.02, 0.006, { axis: 'y', arc: Math.PI, rot: [0, PI, 0], seg: 10, sc: [1, 1, 1] });
  // steam wand + milk jug
  C.tube('metal', [[0.185, 0.3, -0.05], [0.19, 0.14, -0.06], [0.2, 0.09, -0.13], [0.2, 0.065, -0.16]], 0.006, { rseg: 6 }); C.cyl('trim', [0.2, 0.062, -0.165], 0.009, 0.02, { seg: 8 });
  C.cyl('metal', [0.14, 0.085, -0.15], 0.04, 0.09, { rt: 0.046, rb: 0.036, seg: 14 }); C.box('metal', [0.185, 0.092, -0.15], [0.02, 0.012, 0.012], { bev: 0.003 });
  // water tank (translucent, back) + lid
  C.box('glassMed', [0.12, 0.3, 0.17], [0.15, 0.3, 0.1], { bev: 0.004 }); if (!eur) C.box('paintCyan', [0.12, 0.215, 0.17], [0.14, 0.13, 0.09], { bev: 0 }); else C.box('crewIce', [0.12, 0.2, 0.17], [0.14, 0.12, 0.09], { bev: 0 });
  C.box('trim', [0.12, 0.456, 0.17], [0.16, 0.014, 0.11], { bev: 0.005 });
  // bean grinder beside the machine
  C.box('trim', [-0.35, 0.12, 0.05], [0.14, 0.24, 0.17], { bev: 0.012 }); C.box('metal', [-0.35, 0.1, -0.04], [0.08, 0.08, 0.02], { bev: 0.006 });
  C.cyl('glassMed', [-0.35, 0.34, 0.05], 0.07, 0.2, { rt: 0.07, rb: 0.028, seg: 16 }); C.cyl('trim', [-0.35, 0.445, 0.05], 0.072, 0.012, { seg: 16 });
  if (!eur) { C.sph('leather', [-0.35, 0.3, 0.05], [0.05, 0.03, 0.05], { seg: 8 }); C.box(kit.led('Green'), [-0.35, 0.2, -0.037], [0.012, 0.012, 0.004], { bev: 0 }); }
  // spare cups on the warmer deck + a pair on the counter
  const cup = (x, z, y, c = 'paintOrange') => { C.cyl(c, [x, y + 0.035, z], 0.032, 0.07, { rt: 0.036, rb: 0.03, seg: 14 }); C.tor(c, [x + 0.04, y + 0.037, z], 0.017, 0.005, { axis: 'z', arc: PI, rot: [0, 0, -PI / 2], seg: 10 }); if (eur) C.cyl('crewIce', [x, y + 0.062, z], 0.03, 0.005, { seg: 12 }); };
  cup(-0.1, 0.07, 0.412, 'paintWhite'); cup(0.0, 0.07, 0.412, 'paintOrange'); cup(0.1, 0.07, 0.412, 'paintCyan');
  C.box('paintWhite', [-0.23, 0.0, -0.17], [0.01, 0.01, 0.01], { bev: 0 });
  C.cyl('metal', [-0.14, 0.04, 0.17], 0.045, 0.08, { seg: 14 });
  kit.sign('ORPHEUS · ESPRESSO', C.P([0, 0.115, -0.0735]), { w: 0.2, h: 0.035, rot: [0, PI / 2 - PI, 0] });
  kit.interact({ id: 'galley.coffee', label: 'Coffee machine', pos: [wx, wy + 0.22, wz], radius: 1.5, hit: { c: [wx, wy + 0.2, wz + 0.06], s: [0.56, 0.5, 0.86] } });
}
