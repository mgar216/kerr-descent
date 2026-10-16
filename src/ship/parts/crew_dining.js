// GALLEY — dinette (wall bench, bolted table, two stools), Mira's basil on the table, hanging pendant lamp, and the window seat + ledge (galley.window).
// EURYDICE: empty pot, frozen cups, ration packets, log recorder 3 on the table, one stool toppled, seat cushion askew.
import { Frame } from './crew_util.js';
import plant from './crew_plant.js';

export default function dining(kit) {
  const eur = kit.eur, PI = Math.PI, FL = -1.2, CE = 1.35;
  const TY = -0.45;                                                             // table-top height
  // wall bench along the forward partition
  const B = new Frame(kit, [-2.95, 0, 8.31]);
  B.box('white', [0, -1.0, 0], [1.7, 0.4, 0.42], { bev: 0.01 }); B.box('trim', [0, -1.185, 0.01], [1.64, 0.03, 0.38], { bev: 0.004 }); B.box('paintOrange', [0, -0.86, 0.213], [1.7, 0.02, 0.006], { bev: 0 });
  B.box('crewFabB', [0, -0.77, 0.005], [1.68, 0.06, 0.4], { bev: 0.025 }); B.box('crewFabB', [0, -0.52, -0.165], [1.68, 0.42, 0.08], { bev: 0.03, rot: [-0.08, 0, 0] });
  for (const x of [-0.42, 0.42]) B.box('trim', [x, -0.77, 0.206], [0.012, 0.055, 0.006], { bev: 0 });
  kit.colBox([-2.95, FL + 0.23, 8.31], [1.7, 0.46, 0.42]);
  // table (single pedestal bolted to the deck)
  const T = new Frame(kit, [-2.975, 0, 8.97]);
  T.box('wood', [0, TY - 0.02, 0], [1.35, 0.04, 0.7], { bev: 0.01 });
  for (const s of [-1, 1]) { T.box('trim', [0, TY - 0.02, s * 0.356], [1.37, 0.046, 0.012], { bev: 0.003 }); T.box('trim', [s * 0.681, TY - 0.02, 0], [0.012, 0.046, 0.7], { bev: 0.003 }); }
  T.cyl('trim', [0, -0.84, 0], 0.055, 0.74, { seg: 14 }); T.box('trim', [0, TY - 0.055, 0], [0.3, 0.012, 0.3], { bev: 0.004 }); T.cyl('steel', [0, FL + 0.01, 0], 0.2, 0.02, { seg: 22 });
  for (let k = 0; k < 4; k++) T.cyl('metal', [Math.cos(k * PI / 2 + PI / 4) * 0.15, FL + 0.022, Math.sin(k * PI / 2 + PI / 4) * 0.15], 0.012, 0.012, { seg: 8 });
  kit.colBox([-2.975, FL + 0.38, 8.97], [1.35, 0.76, 0.7]);
  // stools (bolted: base plate, column, footring, padded seat)
  const stool = (x, z, tip) => {
    const S = new Frame(kit, [x, FL + (tip ? 0.17 : 0), z], tip ? [0.0, 0.5, 1.45] : 0);
    S.cyl('steel', [0, 0.008, 0], 0.13, 0.016, { seg: 16 }); S.cyl('trim', [0, 0.23, 0], 0.035, 0.43, { seg: 10 }); S.tor('metal', [0, 0.22, 0], 0.15, 0.009, { seg: 20 });
    for (let k = 0; k < 3; k++) S.beam('metal', [0, 0.22, 0], [Math.cos(k * 2.094) * 0.15, 0.22, Math.sin(k * 2.094) * 0.15], 0.012, 0.012);
    S.cyl('trim', [0, 0.435, 0], 0.19, 0.025, { seg: 20 }); S.cyl('crewFabO', [0, 0.47, 0], 0.19, 0.05, { seg: 20 });
    if (!tip) kit.colCyl([x, FL + 0.25, z], 0.2, 0.5);
  };
  stool(-3.3, 9.62, false); stool(-2.65, 9.62, false); if (eur) stool(-3.6, 10.1, true);
  // tabletop clutter + basil / frozen cups
  const mug = (x, z, mat) => { T.cyl(mat, [x, TY + 0.045, z], 0.04, 0.09, { rt: 0.042, rb: 0.037, seg: 16 }); T.tor(mat, [x + 0.043, TY + 0.047, z], 0.026, 0.008, { axis: 'z', arc: PI, rot: [0, 0, -PI / 2], seg: 12 }); if (eur) T.cyl('crewIce', [x, TY + 0.085, z], 0.037, 0.006, { seg: 12 }); else T.cyl('rubber', [x, TY + 0.087, z], 0.037, 0.003, { seg: 12 }); };
  mug(0.46, 0.16, 'paintOrange'); mug(-0.5, -0.18, 'paintWhite'); if (eur) mug(0.2, 0.2, 'paintCyan');
  if (!eur) {
    T.box('plasticDark', [-0.42, TY + 0.008, 0.2], [0.22, 0.016, 0.15], { bev: 0.006, rot: [0, 0.35, 0] }); T.box('screenOff', [-0.42, TY + 0.0165, 0.2], [0.2, 0.002, 0.13], { bev: 0, rot: [0, 0.35, 0] });
    T.box(kit.led('Cyan'), [-0.35, TY + 0.017, 0.15], [0.01, 0.002, 0.01], { bev: 0, rot: [0, 0.35, 0] });
    T.cyl('paintWhite', [0.3, TY + 0.03, -0.25], 0.014, 0.06, { seg: 10 }); T.cyl('paintCyan', [0.34, TY + 0.03, -0.25], 0.014, 0.06, { seg: 10 }); T.box('wood', [-0.2, TY + 0.012, -0.24], [0.14, 0.02, 0.1], { bev: 0.004, rot: [0, -0.2, 0] });
    plant(kit, -2.975, TY, 8.97);
  } else {
    plant(kit, -2.975, TY, 8.97);
    [['paintOrange', 0.5, -0.1, 0.6], ['paintCyan', -0.15, 0.22, -0.4], ['paintOrange', -0.55, 0.1, 1.2], ['paintWhite', 0.1, -0.24, 0.1]].forEach(([m, x, z, r]) => T.box(m, [x, TY + 0.007, z], [0.14, 0.014, 0.09], { bev: 0.003, rot: [0, r, 0] }));
    T.box('paintOrange', [0.34, TY + 0.03, 0.3], [0.1, 0.012, 0.14], { bev: 0.003, rot: [0.12, 0.8, 0.1] });
    kit.recorder(3, [-2.975 - 0.32, TY + 0.025, 8.97 + 0.04], 0.4);
  }
  // pendant lamp over the middle of the galley
  { const P = new Frame(kit, [-2.7, 0, 11.0]);
    P.cyl('metal', [0, (0.78 + CE) / 2, 0], 0.003, CE - 0.78, { seg: 6 }); P.cyl('trim', [0, CE - 0.012, 0], 0.045, 0.024, { seg: 14 });
    P.cyl('white', [0, 0.84, 0], 0.03, 0.12, { rt: 0.03, rb: 0.17, seg: 24 }); P.tor('paintOrange', [0, 0.78, 0], 0.17, 0.008, { seg: 24 }); P.cyl('emitWarm', [0, 0.776, 0], 0.158, 0.006, { seg: 24 });
  }

  // window seat + ledge (outer wall, window z 10.25..11.75, y −0.175..0.675)
  const W = new Frame(kit, [-3.66, 0, 11.0]);
  W.box('white', [0, -0.99, 0], [0.48, 0.42, 1.4], { bev: 0.01 }); W.box('trim', [0, -1.185, 0], [0.44, 0.03, 1.36], { bev: 0.004 });
  for (let k = 0; k < 6; k++) W.box('trim', [0.2425, -1.1 + k * 0.03, 0], [0.006, 0.01, 0.5], { bev: 0 });
  W.box('paintOrange', [0.2425, -0.86, 0], [0.006, 0.02, 1.4], { bev: 0 });
  W.box('crewFabB', [eur ? 0.05 : 0, -0.77, 0], [0.46, 0.07, 1.36], { bev: 0.03, rot: [0, 0, eur ? 0.07 : 0] });
  if (!eur) { W.sph('crewFabO', [0.0, -0.67, -0.5], [0.17, 0.1, 0.12], { seg: 12, rot: [0, 0, 0.4] }); W.sph('crewFab', [0.04, -0.68, 0.46], [0.15, 0.1, 0.11], { seg: 12, rot: [0.2, 0.5, -0.3] }); W.box('paintOrange', [0.0, -0.72, 0.16], [0.3, 0.05, 0.4], { bev: 0.02, rot: [0, 0.25, 0] }); }
  W.box('wood', [-0.18, -0.1625, 0], [0.17, 0.025, 1.62], { bev: 0.004 });
  if (!eur) {
    W.cyl('paintWhite', [-0.17, -0.105, -0.55], 0.035, 0.08, { rt: 0.037, rb: 0.033, seg: 14 });                       // mug
    for (let k = 0; k < 3; k++) W.beam('brass', [-0.17 + (k === 0 ? 0 : (k === 1 ? 0.05 : -0.05)), -0.15, 0.42 + (k === 0 ? -0.05 : 0.04)], [-0.17, -0.0, 0.42], 0.008, 0.008, { bev: 0 });
    W.cyl('brass', [-0.17, 0.04, 0.42], 0.016, 0.24, { rt: 0.016, rb: 0.012, axis: 'x', seg: 12, rot: [0, 0, 0.15] }); W.cyl('brass', [-0.28, 0.06, 0.42], 0.02, 0.05, { axis: 'x', seg: 12 });
  } else { W.cyl('brass', [-0.1, -0.12, 0.3], 0.014, 0.22, { axis: 'z', seg: 10, rot: [0, 0.2, 0] }); }
  kit.colBox([-3.66, FL + 0.25, 11.0], [0.48, 0.5, 1.4]);
  if (!eur) kit.interact({ id: 'galley.window', label: 'Window', pos: [-3.72, 0.2, 11.0], radius: 1.7, hit: { c: [-3.9, 0.25, 11.0], s: [0.2, 0.95, 1.6] } });
}
