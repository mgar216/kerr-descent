// AIRLOCK (z 14..18, port): hazard-striped hatch zone, cyan guide line, grab rails, two suit racks (EVA suit in rack 1, rack 2 empty), suit-up bench + helmet shelf,
// tool board, cycle panel (crew_airpanel.js), ceiling light. EURYDICE: both racks empty with dangling straps / hoses, bench bare, panel working.
import airpanel from './crew_airpanel.js';
import suit, { helmet } from './crew_suit.js';
import { Frame } from './crew_util.js';

export default function airlock(kit) {
  const eur = kit.eur, art = kit.crewArt, PI = Math.PI, FL = -1.2, CE = 1.35;
  airpanel(kit);

  // hazard border + cyan guide on the deck, floor sign, ceiling light
  const hz = (x, z, w, d) => kit.box('hazard', [x, FL + 0.004, z], [w, 0.008, d], { bev: 0 });
  hz(-2.85, 16.0, 0.1, 1.6); hz(-3.375, 15.2, 1.05, 0.1); hz(-3.375, 16.8, 1.05, 0.1);
  kit.box('emitStrip', [-2.05, FL + 0.004, 16.0], [1.55, 0.004, 0.035], { bev: 0 });
  kit.sign('KEEP CLEAR WHEN CYCLING', [-3.35, FL + 0.006, 16.0], { w: 0.8, h: 0.1, rot: [-PI / 2, 0, PI / 2], style: 'warn' });
  kit.box('emitPanel', [-2.6, CE - 0.008, 16.0], [0.9, 0.016, 0.6], { bev: 0 });
  for (const s of [-1, 1]) { kit.box('trim', [-2.6, CE - 0.012, 16.0 + s * 0.32], [1.0, 0.024, 0.04], { bev: 0.004 }); kit.box('trim', [-2.6 + s * 0.47, CE - 0.012, 16.0], [0.04, 0.024, 0.64], { bev: 0.004 }); }

  kit.box('rubber', [-2.725, FL + 0.006, 17.05], [1.9, 0.012, 0.5], { bev: 0.003 }); kit.box('paintWhite', [-2.725, FL + 0.007, 16.8], [1.9, 0.014, 0.01], { bev: 0 });
  // grab rails: vertical bars flanking the hatch, overhead rail to the hatch, wall rail over the bench
  for (const z of [15.3, 16.7]) { kit.cyl('metal', [-3.86, -0.1, z], 0.017, 1.75, { seg: 10 }); for (const y of [-0.85, 0.65]) kit.box('trim', [-3.89, y, z], [0.07, 0.04, 0.04], { bev: 0.006 }); }
  kit.cyl('metal', [-2.55, 1.2, 16.0], 0.016, 2.5, { axis: 'x', seg: 10 }); for (const x of [-3.7, -1.5]) kit.box('trim', [x, 1.27, 16.0], [0.04, 0.12, 0.04], { bev: 0.006 });
  kit.cyl('metal', [-1.32, -0.0, 14.75], 0.016, 1.2, { axis: 'z', seg: 10 }); for (const z of [14.25, 15.25]) kit.box('trim', [-1.29, 0.0, z], [0.06, 0.04, 0.04], { bev: 0.006 });

  // suit racks on the aft partition (rack-local: front −z, back panel at +z)
  const rack = (x, id, withSuit) => {
    const R = new Frame(kit, [x, FL, 17.625]);
    R.box('steel', [0, 0.03, 0], [0.96, 0.06, 0.6], { bev: 0.008 }); R.box('hazard', [0, 0.034, -0.29], [0.96, 0.012, 0.04], { bev: 0 });
    R.box('wallDark', [0, 1.17, 0.285], [0.96, 2.3, 0.03], { bev: 0.006 });
    for (const s of [-1, 1]) R.box('trim', [s * 0.48, 1.2, 0.0], [0.05, 2.4, 0.58], { bev: 0.006 });
    R.box('trim', [0, 2.38, 0.0], [0.98, 0.07, 0.6], { bev: 0.008 }); R.box('paintOrange', [0, 2.318, -0.2], [0.96, 0.014, 0.2], { bev: 0.002 });
    kit.sign(`EVA-0${id}  ${id === 1 ? 'CMDR' : 'SPARE'}`, R.P([0, 2.38, -0.304]), { w: 0.42, h: 0.07, rot: [0, PI, 0] });
    R.box('plasticDark', [0, 1.3, 0.262], [0.34, 0.44, 0.022], { bev: 0.006 }); R.box('metal', [0, 1.58, 0.268], [0.5, 0.04, 0.05], { bev: 0.006 });
    for (const s of [-1, 1]) R.cyl('metal', [s * 0.07, 1.14, 0.245], 0.02, 0.03, { axis: 'z', seg: 10 });
    R.box(kit.led(withSuit ? 'Green' : (eur ? 'Red' : 'Amber'), eur ? 'Blink' : ''), [0.12, 1.45, 0.249], [0.016, 0.016, 0.004], { bev: 0 }); R.box(kit.led(withSuit ? 'Cyan' : 'Red'), [-0.12, 1.45, 0.249], [0.016, 0.016, 0.004], { bev: 0 });
    kit.sign('PLSS DOCK', R.P([0, 1.12, 0.249]), { w: 0.22, h: 0.03, rot: [0, PI, 0] });
    if (withSuit && !eur) {
      suit(kit, R.sub([0, 0.06, -0.04]));
      R.box('paintOrange', [0, 1.4, -0.205], [0.96, 0.022, 0.008], { bev: 0.002 }); R.box('metal', [0.1, 1.4, -0.21], [0.045, 0.045, 0.01], { bev: 0.004 });
    } else {                                                                  // empty rack: dangling straps + dock hoses
      const sag = eur ? 1 : 0;
      for (const [sx, h] of [[-0.4, 0.55], [0.34, 0.35], [-0.2, 0.25]]) { R.box('paintOrange', [sx, 1.62 - h / 2, -0.12 - sx * 0.05], [0.035, h, 0.012], { bev: 0.002, rot: [sag * 0.12, 0, sag * sx * 0.3] }); R.box('metal', [sx, 1.62 - h, -0.12 - sx * 0.05], [0.05, 0.035, 0.016], { bev: 0.004 }); }
      for (const s of [-1, 1]) R.tube('rubber', [[s * 0.07, 1.14, 0.23], [s * 0.1, 0.96, 0.2], [s * 0.16, 0.62, 0.06], [s * 0.1 + (eur ? s * 0.12 : 0), 0.2, -0.1]], 0.014, { rseg: 6 });
      R.box('paintOrange', [0, 0.1, -0.1], [0.38, 0.03, 0.26], { bev: 0.008, rot: [0, 0.4, 0] });
    }
    kit.colBox([x, FL + 1.2, 17.625], [0.96, 2.4, 0.6]);
    return R;
  };
  rack(-3.3, 1, true); rack(-2.15, 2, false);
  if (!eur) kit.interact({ id: 'airlock.suit', label: 'EVA suit', pos: [-3.3, 0.2, 17.55], radius: 1.7, hit: { c: [-3.3, -0.25, 17.55], s: [0.78, 1.95, 0.62] } });
  kit.sign('EVA SUIT LOCKER', [-2.725, 1.16, 17.9], { w: 0.6, h: 0.07, rot: [0, PI, 0], style: 'door' });

  // suit-up bench + helmet shelf + checklist (forward partition)
  const Bn = new Frame(kit, [-2.075, 0, 14.3]);
  Bn.box('white', [0, -1.0, 0], [1.45, 0.4, 0.4], { bev: 0.01 }); Bn.box('trim', [0, -1.185, 0.01], [1.4, 0.03, 0.36], { bev: 0.004 }); Bn.box('crewFabO', [0, -0.77, 0.0], [1.43, 0.06, 0.38], { bev: 0.025 });
  Bn.box('paintOrange', [0, -0.86, 0.201], [1.45, 0.02, 0.006], { bev: 0 }); kit.colBox([-2.075, FL + 0.23, 14.3], [1.45, 0.46, 0.4]);
  const Sh = new Frame(kit, [-2.15, 0.12, 14.17]);
  Sh.box('wood', [0, 0, 0], [1.2, 0.03, 0.22], { bev: 0.005 }); for (const x of [-0.5, 0.5]) Sh.beam('trim', [x, -0.015, 0.0], [x, -0.17, -0.07], 0.02, 0.02, { bev: 0.003 });
  art.put(new Frame(kit, [-2.15, 0.72, 14.085]), 'list', [0, 0, 0], 0.3, 0.41); kit.box('trim', [-2.15, 0.72, 14.082], [0.32, 0.43, 0.006], { bev: 0.002 });
  if (!eur) {
    [-0.38, 0.0, 0.38].forEach((x, i) => { helmet(kit, new Frame(kit, [-2.15 + x, 0.12 + 0.015 + 0.15, 14.19], [0, PI + (i === 1 ? 0.35 : -0.25), 0])); Sh.cyl('trim', [x, 0.025, 0.02], 0.07, 0.02, { seg: 14 }); });
    Bn.box('leather', [-0.4, -0.72, 0.0], [0.1, 0.18, 0.26], { bev: 0.02, rot: [0, 0.2, 0] }); Bn.box('leather', [-0.25, -0.72, 0.04], [0.1, 0.18, 0.26], { bev: 0.02, rot: [0, -0.3, 0] });
    Bn.box('plasticDark', [0.35, -0.72, 0.0], [0.07, 0.04, 0.2], { bev: 0.01 }); Bn.box('plasticDark', [0.46, -0.72, 0.02], [0.07, 0.04, 0.2], { bev: 0.01, rot: [0, 0.4, 0] });
  } else { Sh.box('plasticDark', [0.1, 0.05, 0.0], [0.07, 0.07, 0.15], { bev: 0.015, rot: [0, 0.6, 0] }); }

  // tool board + gauges + extinguisher on the corridor wall (aft segment / forward segment)
  const Tb = new Frame(kit, [-1.25, 0.1, 16.95], PI / 2);
  Tb.box('plasticDark', [0, 0, -0.012], [0.62, 0.98, 0.024], { bev: 0.004 }); Tb.box('trim', [0, 0.5, -0.014], [0.66, 0.02, 0.03], { bev: 0.004 });
  if (!eur) {
    Tb.box('metal', [-0.18, 0.28, -0.035], [0.02, 0.28, 0.012], { bev: 0.003 }); Tb.box('metal', [-0.18, 0.46, -0.035], [0.05, 0.05, 0.012], { bev: 0.003 });
    Tb.box('paintOrange', [0.0, 0.3, -0.035], [0.025, 0.3, 0.014], { bev: 0.004 }); Tb.cyl('trim', [0.0, 0.14, -0.04], 0.018, 0.04, { seg: 8 });
    Tb.cyl('paintCyan', [0.17, 0.3, -0.04], 0.018, 0.3, { seg: 8 }); Tb.box('trim', [0.17, 0.12, -0.04], [0.04, 0.04, 0.03], { bev: 0.008 });
    Tb.box('paintOrange', [-0.1, -0.15, -0.075], [0.3, 0.2, 0.1], { bev: 0.015 }); Tb.box('trim', [-0.1, -0.15, -0.126], [0.1, 0.03, 0.02], { bev: 0.005 });
    Tb.tor('paintOrange', [0.15, -0.2, -0.055], 0.09, 0.03, { axis: 'z', seg: 22, tube: 8 }); Tb.cyl('paintOrange', [0.15, -0.2, -0.055], 0.065, 0.06, { axis: 'z', seg: 22 }); Tb.box('metal', [0.15, -0.2, -0.095], [0.05, 0.03, 0.04], { bev: 0.006 });
    Tb.box('paintWhite', [0.0, -0.36, -0.03], [0.5, 0.012, 0.02], { bev: 0 });
  } else { Tb.box('metal', [-0.18, 0.2, -0.035], [0.02, 0.28, 0.012], { bev: 0.003, rot: [0, 0, 0.5] }); }
  kit.sign('EVA TOOLS', Tb.P([0, 0.57, -0.026]), { w: 0.3, h: 0.05, rot: [0, -PI / 2, 0], style: 'door' });
  if (!eur) { kit.cyl('paintOrange', [-1.31, -0.45, 15.18], 0.045, 0.3, { seg: 14 }); kit.cyl('metal', [-1.31, -0.28, 15.18], 0.02, 0.05, { seg: 8 }); kit.box('trim', [-1.29, -0.3, 15.2], [0.04, 0.03, 0.06], { bev: 0.006 }); }
  // air-bottle storage: two cylinders on the outer wall aft of the hatch
  for (const z of [17.02, 17.2]) { kit.cyl('steel', [-3.83, -0.62, z], 0.075, 1.0, { seg: 14 }); kit.cyl('paintCyan', [-3.83, -0.3, z], 0.077, 0.1, { seg: 14 }); kit.cyl('metal', [-3.83, 0.0, z], 0.03, 0.08, { seg: 10 }); }
  kit.box('trim', [-3.89, -0.45, 17.11], [0.06, 0.04, 0.3], { bev: 0.006 }); kit.colCyl([-3.83, -0.7, 17.11], 0.2, 1.0);
}
