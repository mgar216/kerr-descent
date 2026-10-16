// QUARTERS (z 3..8, port): composes bunk + desk modules and adds the rest — personal locker, rug, porthole bezel + roller blind, poster, child's drawing,
// ceiling light, jacket/boots, intercom. EURYDICE: locker door hangs open, blind torn, personal items gone.
import bunk from './crew_bunk.js';
import desk from './crew_desk.js';
import { Frame } from './crew_util.js';

export default function quarters(kit) {
  const eur = kit.eur, art = kit.crewArt, FL = -1.2, CE = 1.35, PI = Math.PI;
  bunk(kit); desk(kit);

  // ceiling light (warm panel in a trim frame) + small spot above the desk
  kit.box('emitWarm', [-2.6, CE - 0.008, 5.5], [0.9, 0.016, 0.5], { bev: 0 });
  for (const s of [-1, 1]) { kit.box('trim', [-2.6, CE - 0.012, 5.5 + s * 0.27], [1.0, 0.024, 0.04], { bev: 0.004 }); kit.box('trim', [-2.6 + s * 0.47, CE - 0.012, 5.5], [0.04, 0.024, 0.58], { bev: 0.004 }); }
  kit.box('emitWarm', [-3.35, CE - 0.008, 3.8], [0.4, 0.016, 0.3], { bev: 0 });

  // porthole: bezel ring (hides the square wall cut), bolts, roller blind
  const B = new Frame(kit, [-3.905, 0.25, 5.6], [0, PI / 2, 0]);
  B.ring('trim', [0, 0, 0], 0.345, 0.57, 0.04, { seg: 36 }); B.ring('steel', [0, 0, 0.0215], 0.345, 0.41, 0.006, { seg: 36 });
  for (let k = 0; k < 12; k++) { if (eur && k % 5 === 2) continue; const a = k * PI / 6 + 0.1; B.cyl('metal', [Math.cos(a) * 0.49, Math.sin(a) * 0.49, 0.022], 0.013, 0.012, { axis: 'z', seg: 8 }); }
  const W = new Frame(kit, [-3.865, 0, 5.6]);
  W.cyl('white', [0, 0.78, 0], 0.03, 0.8, { axis: 'z', seg: 12 }); for (const s of [-1, 1]) { W.cyl('trim', [0, 0.78, s * 0.405], 0.036, 0.02, { axis: 'z', seg: 12 }); W.box('trim', [-0.012, 0.78, s * 0.43], [0.04, 0.05, 0.03], { bev: 0.005 }); }
  if (!eur) {
    W.box('crewFab', [-0.008, 0.745 - 0.18, 0], [0.008, 0.36, 0.76], { bev: 0 }); W.box('trim', [-0.008, 0.745 - 0.36, 0], [0.018, 0.022, 0.78], { bev: 0.004 });
    W.tube('rubber', [[0.0, 0.38, 0.3], [0.0, 0.5, 0.31], [0.0, 0.18, 0.3]], 0.003); W.sph('paintOrange', [0.0, 0.17, 0.3], 0.014, { seg: 8 });
  } else {                                                                      // torn, unevenly hanging blind
    W.box('crewFab', [-0.008, 0.745 - 0.3, -0.19], [0.008, 0.6, 0.36], { bev: 0, rot: [0.06, 0, 0] }); W.box('crewFab', [-0.008, 0.745 - 0.12, 0.2], [0.008, 0.24, 0.38], { bev: 0 }); W.box('crewFab', [-0.01, 0.745 - 0.5, 0.0], [0.006, 0.18, 0.1], { bev: 0, rot: [0, 0, 0.5] });
    W.box('trim', [-0.008, 0.745 - 0.6, -0.19], [0.018, 0.022, 0.36], { bev: 0.004, rot: [0.06, 0, 0] });
  }

  // posters / drawing on the outer wall (faces +x)
  const A = new Frame(kit, [-3.915, 0.86, 3.75], [0, PI / 2, 0]);
  A.box('trim', [0, 0, 0.004], [0.53, 0.73, 0.008], { bev: 0.003 }); art.put(A, 'poster', [0, 0, 0.0085], 0.5, 0.7);
  if (!eur) {
    const Dw = new Frame(kit, [-3.918, 0.4, 4.82], [0, PI / 2, 0.03]);
    Dw.box('paintWhite', [0, 0, 0.002], [0.3, 0.225, 0.004], { bev: 0 }); art.put(Dw, 'drawing', [0, 0, 0.0045], 0.3, 0.225);
    for (const sx of [-1, 1]) Dw.box('paintWhite', [sx * 0.13, 0.108, 0.006], [0.06, 0.016, 0.003], { bev: 0, rot: [0, 0, sx * 0.5] });
  }

  // rug in the aisle between bunk and desk area
  kit.box('rubber', [-2.3, FL + 0.006, 6.35], [1.2, 0.012, 1.5], { bev: 0.003, yaw: 0.04 });
  art.put(new Frame(kit, [-2.3, FL + 0.0125, 6.35], [0, 0.04, 0]), 'rug', [0, 0, 0], 1.5, 1.2, [-PI / 2, PI / 2, 0]);

  // personal locker on the corridor wall (aft corner); EURYDICE: door ajar, empty
  const L = new Frame(kit, [-1.525, FL, 7.5], PI / 2);
  L.box('white', [0, 0.975, 0], [0.65, 1.95, 0.5], { bev: 0.012 }); L.box('trim', [0, 1.955, 0], [0.66, 0.02, 0.51], { bev: 0.005 });
  L.box('paintOrange', [0, 1.85, -0.2535], [0.64, 0.045, 0.006], { bev: 0 });
  const door = (sx, open) => {
    const H = L.sub([sx * 0.325, 0, -0.25], open ? [0, -sx * 1.85, 0] : 0), cx = -sx * 0.1575;
    H.box('steel', [cx, 0.96, -0.0065], [0.3, 1.8, 0.013], { bev: 0.004 }); H.box('trim', [cx, 0.96, -0.014], [0.27, 1.76, 0.003], { bev: 0.001 });
    for (let k = 0; k < 5; k++) H.box('trim', [cx, 1.72 + k * 0.022, -0.016], [0.2, 0.01, 0.006], { bev: 0 });
    H.box('metal', [-sx * 0.025, 1.0, -0.025], [0.014, 0.22, 0.02], { bev: 0.004 });
    H.box(kit.led(eur ? 'Red' : 'Green'), [-sx * 0.03, 1.28, -0.017], [0.012, 0.012, 0.006], { bev: 0 });
  };
  door(-1, false); door(1, eur);
  if (eur) { L.box('wallDark', [0.16, 0.96, 0.24], [0.3, 1.8, 0.01], { bev: 0 }); L.box('metal', [0.16, 0.6, 0.0], [0.28, 0.012, 0.4], { bev: 0.002 }); L.box('metal', [0.16, 1.4, 0.0], [0.28, 0.012, 0.4], { bev: 0.002 }); for (const z of [-0.1, 0.1]) L.box('trim', [0.16, 1.8, z], [0.01, 0.01, 0.1], { bev: 0.002 }); }
  else kit.sign('CMDR  ·  PERSONAL', L.P([0, 1.6, -0.262]), { w: 0.3, h: 0.07, rot: [0, -PI / 2, 0] });
  kit.colBox([-1.525, FL + 0.975, 7.5], [0.5, 1.95, 0.65]);
  // pin-board on the forward partition (notes + pushpins), ceiling duct along the outer wall
  const Pb = new Frame(kit, [-2.35, 0.5, 3.082], 0);
  Pb.box('trim', [0, 0, 0.008], [0.74, 0.54, 0.016], { bev: 0.004 }); Pb.box('wood', [0, 0, 0.0175], [0.7, 0.5, 0.004], { bev: 0 });
  (eur ? [[0.18, 0.1, 0.2, 0.15, 'paintWhite', 0.5]] : [[-0.22, 0.12, 0.2, 0.15, 'paintWhite', 0.15], [0.05, 0.14, 0.12, 0.16, 'paintOrange', -0.1], [0.24, 0.05, 0.14, 0.1, 'paintCyan', 0.2], [-0.08, -0.12, 0.2, 0.14, 'paintWhite', -0.08], [0.22, -0.14, 0.1, 0.15, 'paintWhite', 0.1]]).forEach(([x, y, w, h, m, r]) => { Pb.box(m, [x, y, 0.021], [w, h, 0.002], { bev: 0, rot: [0, 0, r] }); Pb.cyl('paintOrange', [x, y + h / 2 - 0.02, 0.025], 0.006, 0.006, { axis: 'z', seg: 6 }); });
  kit.box('steel', [-3.82, CE - 0.11, 5.5], [0.2, 0.22, 4.7], { bev: 0.01 }); kit.box('paintCyan', [-3.718, CE - 0.14, 5.5], [0.004, 0.03, 4.7], { bev: 0 });
  for (const z of [3.7, 5.0, 6.3, 7.5]) kit.box('trim', [-3.82, CE - 0.11, z], [0.23, 0.245, 0.05], { bev: 0.006 });

  if (!eur) {
    // flight jacket on a wall hook + boots + intercom
    const J = new Frame(kit, [-1.3, 0.5, 6.3], PI / 2);
    J.cyl('metal', [0, 0, 0.0], 0.012, 0.04, { axis: 'z', seg: 8 }); J.box('trim', [0, 0.01, 0.0], [0.05, 0.03, 0.03], { bev: 0.004 });
    J.box('crewFabO', [0, -0.3, -0.02], [0.42, 0.55, 0.075], { bev: 0.03 }); J.box('trim', [0, -0.03, -0.015], [0.2, 0.05, 0.08], { bev: 0.015 });
    for (const s of [-1, 1]) J.box('crewFabO', [s * 0.255, -0.32, -0.02], [0.09, 0.5, 0.07], { bev: 0.025, rot: [0, 0, s * 0.06] });
    J.box('paintCyan', [0.1, -0.2, -0.062], [0.08, 0.08, 0.004], { bev: 0.002 }); J.box('trim', [0, -0.58, -0.02], [0.42, 0.03, 0.078], { bev: 0.01 });
    for (const [x, z, r] of [[-1.75, 7.0, 0.3], [-1.66, 6.75, -0.1]]) { const Bt = new Frame(kit, [x, FL, z], r); Bt.box('leather', [0, 0.11, 0.0], [0.1, 0.2, 0.26], { bev: 0.02 }); Bt.box('rubber', [0, 0.01, -0.01], [0.105, 0.02, 0.28], { bev: 0.006 }); Bt.box('leather', [0, 0.2, 0.06], [0.09, 0.2, 0.1], { bev: 0.02 }); }
    kit.box('plasticDark', [-1.262, 0.15, 5.55], [0.024, 0.16, 0.11], { bev: 0.004 }); kit.box(kit.led('Green'), [-1.276, 0.205, 5.55], [0.004, 0.012, 0.012], { bev: 0 });
    for (let k = 0; k < 4; k++) kit.box('trim', [-1.276, 0.1 + k * 0.014, 5.55], [0.004, 0.006, 0.08], { bev: 0 });
  } else {
    kit.box('plasticDark', [-1.262, 0.15, 5.55], [0.024, 0.16, 0.11], { bev: 0.004 }); kit.box('screenOff', [-1.276, 0.205, 5.55], [0.004, 0.012, 0.012], { bev: 0 });
  }
}
