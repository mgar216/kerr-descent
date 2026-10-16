// SCIENCE LAB instruments (1/2): GRAVIMETER (lab.gravimeter) and SPECTROMETER (lab.spectrometer). Analyzer + wall display: science_instr2.js
import * as S from './screens.js';
import { eul, FL, BT } from './science_util.js';
import instr2 from './science_instr2.js';

const TAU = Math.PI * 2;

function gravimeter(kit) {
  const eur = kit.eur, THREE = kit.THREE, cx = 3.3, cz = 7.25, pTop = FL + 0.27;
  // vibration-isolated base: granite slab on four air-spring isolators, steel top plate, cyan edge strips
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = cx + sx * 0.34, z = cz + sz * 0.34;
    kit.cyl('sciSteel', [x, FL + 0.04, z], 0.05, 0.08, { seg: 12 });
    for (let k = 0; k < 3; k++) kit.torus('rubber', [x, FL + 0.065 + k * 0.012, z], 0.045, 0.013, { seg: 14, tube: 6 });
  }
  kit.box('sciStone', [cx, FL + 0.17, cz], [0.84, 0.14, 0.84], { bev: 0.012 });
  kit.box('sciSteel', [cx, FL + 0.255, cz], [0.78, 0.03, 0.78], { bev: 0.006 });
  for (const s of [-1, 1]) { kit.box('emitStrip', [cx + s * 0.422, FL + 0.17, cz], [0.004, 0.012, 0.66], { bev: 0 }); kit.box('emitStrip', [cx, FL + 0.17, cz + s * 0.422], [0.66, 0.012, 0.004], { bev: 0 }); }
  kit.sign('GRAVIMETER · LCR-9', [cx - 0.426, FL + 0.17, cz], { w: 0.42, h: 0.085, rot: [0, -Math.PI / 2, 0], style: 'door' });
  kit.box(kit.led(eur ? 'Red' : 'Green'), [cx - 0.425, FL + 0.17, cz + 0.28], [0.004, 0.02, 0.02], { bev: 0 });
  kit.box(kit.led('Amber', eur ? '' : 'Blink'), [cx - 0.425, FL + 0.17, cz + 0.32], [0.004, 0.02, 0.02], { bev: 0 });
  // tripod (three legs + braces) carrying the sensor head
  const leg = (k, r, y) => [cx + Math.cos(k * TAU / 3 + 0.5) * r, y, cz + Math.sin(k * TAU / 3 + 0.5) * r];
  for (let k = 0; k < 3; k++) {
    kit.beam('sciSteel', leg(k, 0.31, pTop), leg(k, 0.09, -0.2), 0.036, 0.036, { bev: 0.008 });
    kit.beam('sciCabDk', leg(k, 0.255, pTop + 0.3), leg((k + 1) % 3, 0.255, pTop + 0.3), 0.018, 0.018, { bev: 0.004 });
    kit.cyl('rubber', [leg(k, 0.31, pTop)[0], pTop + 0.02, leg(k, 0.31, pTop)[2]], 0.035, 0.04, { seg: 10 });
  }
  kit.cyl('sciCabDk', [cx, -0.2, cz], 0.14, 0.06, { seg: 20 });
  kit.cyl('sciSteel', [cx, -0.04, cz], 0.17, 0.26, { seg: 24 }); kit.torus('sciSteel', [cx, 0.09, cz], 0.17, 0.012, { seg: 24, tube: 6 });
  kit.torus('brass', [cx, -0.17, cz], 0.172, 0.008, { seg: 24, tube: 5 });
  kit.cyl('sciCabDk', [cx + 0.22, -0.02, cz - 0.1], 0.06, 0.2, { seg: 14, axis: 'x' }); kit.cyl('sciSteel', [cx + 0.1, -0.02, cz - 0.1], 0.02, 0.2, { seg: 8, axis: 'x' });   // ion pump + stub
  // glass drop chamber, top cap, vacuum line to the ceiling
  const glass = new THREE.CylinderGeometry(0.15, 0.15, 0.9, 28, 1, true, eur ? 0.6 : 0, eur ? 4.4 : TAU);
  kit.add('sciGlass', glass, { pos: [cx, 0.54, cz] }); glass.dispose();
  kit.cyl('sciSteel', [cx, 1.02, cz], 0.18, 0.1, { seg: 24 }); kit.torus('sciSteel', [cx, 0.98, cz], 0.17, 0.01, { seg: 24, tube: 5 });
  kit.cyl('sciCabDk', [cx, 1.2, cz], 0.04, 0.3, { seg: 10 }); kit.box('sciCabDk', [cx, 1.12, cz + 0.07], [0.07, 0.07, 0.09], { bev: 0.008 });
  // torsion fibre + hanging test mass, interferometer laser crossing the chamber
  if (!eur) {
    kit.cyl('emitCyan', [cx, 0.7, cz], 0.0025, 0.64, { seg: 4 });
    kit.sphere('brass', [cx, 0.36, cz], 0.045, { seg: 16 }); kit.cyl('sciSteel', [cx, 0.36, cz - 0.046], 0.022, 0.004, { axis: 'z', seg: 10 });
    kit.torus('brass', [cx, 0.37, cz], 0.025, 0.004, { seg: 12, tube: 4, rot: [0.5, 0.2, 0] });
    kit.box('emitRed', [cx, 0.36, cz], [0.006, 0.006, 0.7], { bev: 0 });
  } else {
    kit.sphere('brass', [cx + 0.05, pTop + 0.05, cz + 0.1], 0.045, { seg: 12 });
    kit.cyl('trim', [cx, 0.9, cz], 0.002, 0.14, { seg: 4 });
    for (let i = 0; i < 6; i++) kit.box('sciGlass', [cx + (i % 3 - 1) * 0.12, pTop + 0.012, cz + (i % 2 ? 0.2 : -0.18)], [0.05, 0.004, 0.035], { bev: 0, yaw: i * 1.3 });
  }
  for (const s of [-1, 1]) {
    kit.cyl('sciCabDk', [cx, -0.28, cz + s * 0.38], 0.028, 1.3, { seg: 8 }); kit.box('sciCabDk', [cx, 0.36, cz + s * 0.38], [0.08, 0.08, 0.14], { bev: 0.01 });
  }
  kit.box(eur ? 'screenOff' : 'emitRed', [cx, 0.36, cz - 0.455], [0.016, 0.016, 0.006], { bev: 0 });
  // swing-arm readout facing the aisle
  kit.beam('sciCabDk', [cx - 0.14, -0.1, cz], [cx - 0.38, 0.04, cz], 0.04, 0.04, { bev: 0.008 }); kit.sphere('sciSteel', [cx - 0.38, 0.04, cz], 0.03, { seg: 10 });
  kit.box('sciCabDk', [cx - 0.43, 0.1, cz], [0.04, 0.24, 0.34], { bev: 0.008 });
  kit.screen({
    id: 'lab.gravimeter.scr', pos: [cx - 0.455, 0.1, cz], rot: eul(THREE, -Math.PI / 2, -0.1), size: [0.3, 0.19], res: [256, 160], range: 9,
    draw: (g, W, H, t) => {
      const c = S.base(g, W, H, t, { title: 'GRAVIMETER', sub: 'FIBRE LOCK' });
      S.mono(g, (9.81 + Math.sin(t * 0.5) * 3e-5 + Math.sin(t * 3.1) * 8e-6).toFixed(5), c.x + 4, H * 0.43, 38, S.C.ink, 'left', 700); S.mono(g, 'm/s²', W - 16, H * 0.43, 15, S.C.cyd, 'right');
      S.line(g, c.x, H * 0.5, c.w, 28, (u) => 0.5 + 0.33 * Math.sin(u * 9 + t * 1.2) + 0.1 * Math.sin(u * 31 - t * 3), S.C.cy, 72);
      S.table(g, c.x, H * 0.85, [['TIDE', '+0.42 µGal'], ['DRIFT', '−0.003 µGal/h', S.C.green]], { size: 11, gap: 3, colW: 56 });
    },
  });
  kit.interact({ id: 'lab.gravimeter', label: 'Gravimeter', pos: [cx - 0.35, -0.15, cz], radius: 1.6, hit: { c: [cx, -0.05, cz], s: [0.9, 2.4, 0.9] } });
  kit.colBox([cx, FL + 1.2, cz], [0.9, 2.4, 0.9]);
}

function spectrometer(kit) {
  const eur = kit.eur, THREE = kit.THREE, bx = 3.6, y = BT + 0.1, z0 = 5.1;
  kit.box('sciSteel', [bx, BT + 0.015, 5.72], [0.46, 0.03, 1.5], { bev: 0.004 });                       // breadboard
  kit.box('sciCabDk', [bx, BT + 0.036, 5.72], [0.045, 0.014, 1.4], { bev: 0.003 });                      // rail
  for (let i = 0; i < 14; i++) for (const s of [-1, 1]) kit.cyl('trim', [bx + s * 0.2, BT + 0.031, 5.04 + i * 0.1], 0.006, 0.004, { seg: 6 });
  // lamp housing + slit + collimating lens + prism + focusing lens
  kit.box('sciCabDk', [bx, y, z0], [0.12, 0.12, 0.2], { bev: 0.012 });
  for (let i = 0; i < 6; i++) kit.box('trim', [bx, y + 0.065, z0 - 0.07 + i * 0.026], [0.1, 0.008, 0.012], { bev: 0 });
  kit.box(eur ? 'screenOff' : 'emitWhite', [bx, y, z0 + 0.102], [0.03, 0.03, 0.004], { bev: 0 });
  kit.box('trim', [bx - 0.02, y, 5.36], [0.03, 0.1, 0.01], { bev: 0.002 }); kit.box('trim', [bx + 0.02, y, 5.36], [0.03, 0.1, 0.01], { bev: 0.002 });    // slit jaws
  const lens = (z, r, tilt = 0) => {
    kit.sphere('sciGlass', [bx, y, z], r, { sz: 0.16, seg: 16 }); kit.torus('sciSteel', [bx, y, z], r + 0.004, 0.006, { seg: 16, tube: 5, axis: 'z' });
    kit.cyl('sciSteel', [bx, BT + 0.05, z], 0.014, 0.05, { seg: 8 }); kit.cyl('sciCabDk', [bx, BT + 0.055, z], 0.03, 0.02, { seg: 10 });
  };
  lens(5.5, 0.055);
  kit.extrude('sciGlass', [[-0.05, 0], [0.05, 0], [0, 0.087]], 0.09, { pos: [bx, y, 5.76], rot: [-Math.PI / 2, 0, 0] });
  kit.cyl('sciSteel', [bx, BT + 0.045, 5.76], 0.045, 0.03, { seg: 14 });
  // beams: input white, dispersed fan to the detector (colour-coded emissive hair-lines)
  const detZ = 6.2, fan = ['emitRed', 'emitAmber', 'emitGreen', 'emitCyan', 'emitBlue'];
  if (!eur) {
    kit.beam('emitWhite', [bx, y, z0 + 0.1], [bx, y, 5.74], 0.005, 0.005, { bev: 0 });
    fan.forEach((m, i) => kit.beam(m, [bx - 0.01, y, 5.8], [bx - 0.1 + i * 0.05, y, detZ - 0.04], 0.005, 0.005, { bev: 0 }));
  }
  kit.box('sciCabDk', [bx, y, detZ], [0.26, 0.1, 0.08], { bev: 0.01 });                                    // detector array
  fan.forEach((m, i) => kit.box(eur ? 'screenOff' : m, [bx - 0.1 + i * 0.05, y, detZ - 0.042], [0.03, 0.04, 0.004], { bev: 0 }));
  kit.cyl('sciSteel', [bx, BT + 0.045, detZ], 0.06, 0.03, { seg: 12 });
  kit.tube('rubber', [[bx, y, detZ + 0.04], [bx + 0.15, BT + 0.05, detZ + 0.2], [3.85, BT + 0.1, 6.5], [3.9, 1.1, 6.5]], 0.008, { rseg: 5 });
  kit.tube('rubber', [[bx, y - 0.04, z0 - 0.1], [bx + 0.18, BT + 0.05, z0 - 0.2], [3.85, BT + 0.1, 4.95], [3.9, 1.1, 4.95]], 0.008, { rseg: 5 });
  // spectrum monitor on the bench end
  kit.box('sciCabDk', [3.52, BT + 0.07, 6.5], [0.05, 0.14, 0.2], { bev: 0.008, yaw: 0 });
  kit.screen({
    id: 'lab.spectrometer.scr', pos: [3.52 - 0.03, BT + 0.19, 6.5], rot: eul(THREE, -Math.PI / 2, -0.22), size: [0.3, 0.19], res: [256, 160], range: 9,
    draw: (g, W, H, t) => {
      const c = S.base(g, W, H, t, { title: 'SPECTROMETER', sub: 'SLIT 40 µm' });
      const gr = g.createLinearGradient(c.x, 0, c.x + c.w, 0); [['#7a2cff', 0], ['#2c5cff', 0.18], ['#18d8e0', 0.36], ['#3cff6c', 0.5], ['#ffe030', 0.68], ['#ff7a20', 0.84], ['#ff2020', 1]].forEach(([col, p]) => gr.addColorStop(p, col));
      g.globalAlpha = 0.55; g.fillStyle = gr; g.fillRect(c.x, H * 0.63, c.w, 9); g.globalAlpha = 1;
      S.line(g, c.x, H * 0.3, c.w, H * 0.3, (u) => 0.55 + 0.18 * Math.sin(u * 5) - 0.32 * Math.exp(-Math.pow((u - 0.34) * 40, 2)) - 0.4 * Math.exp(-Math.pow((u - 0.62) * 55, 2)) + 0.28 * Math.exp(-Math.pow((u - 0.8) * 30, 2)), S.C.cy, 90);
      const sc = (t * 0.12) % 1; g.fillStyle = 'rgba(255,176,77,0.8)'; g.fillRect(c.x + sc * c.w, H * 0.3, 1.5, H * 0.3 + 9);
      S.table(g, c.x, H * 0.86, [['λ', (380 + sc * 400).toFixed(1) + ' nm'], ['LINE', 'Na D · Hα', S.C.amber]], { size: 11, gap: 3, colW: 44 });
    },
  });
  kit.interact({ id: 'lab.spectrometer', label: 'Spectrometer', pos: [3.4, -0.1, 5.75], radius: 1.5, hit: { c: [bx, -0.1, 5.78], s: [0.6, 0.45, 1.55] } });
}

export default function build(kit) {
  gravimeter(kit); spectrometer(kit); instr2(kit);
}
