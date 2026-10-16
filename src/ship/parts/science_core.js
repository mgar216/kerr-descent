// LYRA CORE room (z 14..18): base plinth with segmented status ring, top collar, cooling conduits, operator consoles, floor/ceiling accents,
// interactable core.lyra (derelict: dead THEA column, eur.core). Column effects: science_corefx.js, lattice maths/shader: science_lattice.js
import * as S from './screens.js';
import { wall, eul, ZR, FL, CE } from './science_util.js';
import { Y0, Y1 } from './science_lattice.js';
import { lyra, thea } from './science_corefx.js';

const CX = 2.75, CZ = 16.0;

function plinth(kit) {
  const eur = kit.eur;
  kit.cyl('trim', [CX, FL + 0.025, CZ], 0.6, 0.05, { seg: 40 });
  kit.cyl('sciCabDk', [CX, FL + 0.1, CZ], 0.56, 0.1, { seg: 40 });
  kit.cyl('trim', [CX, FL + 0.18, CZ], 0.5, 0.1, { seg: 40 });
  kit.cyl('trim', [CX, Y0 - 0.015, CZ], 0.53, 0.03, { seg: 40 });
  kit.torus('emitStrip', [CX, Y0 - 0.002, CZ], 0.535, 0.008, { seg: 56, tube: 5 });
  for (let i = 0; i < 12; i++) {                                                     // segmented ring + LED slits
    const a = i * Math.PI / 6, c = Math.cos(a), s = Math.sin(a), broken = eur && i === 4;
    kit.box(i % 2 ? 'white' : 'sciCab', [CX + c * 0.52, FL + 0.19, CZ + s * 0.52], [0.04 + 0.0, 0.07, 0.26], { bev: 0.006, yaw: -a + (broken ? 0.12 : 0), rot: broken ? [0.0, -a, 0.35] : null });
    const b = a + Math.PI / 12; kit.box(eur ? (i % 5 === 0 ? kit.led('Red', 'Rand') : 'screenOff') : kit.led(['Cyan', 'Green', 'Cyan', 'Amber'][i % 4], i % 5 === 3 ? 'Blink' : ''), [CX + Math.cos(b) * 0.535, FL + 0.19, CZ + Math.sin(b) * 0.535], [0.012, 0.05, 0.02], { bev: 0, yaw: -b });
  }
  for (let i = 0; i < 6; i++) kit.cyl('sciSteel', [CX + Math.cos(i * 1.047 + 0.5) * 0.46, Y0 + 0.07, CZ + Math.sin(i * 1.047 + 0.5) * 0.46], 0.022, 0.1, { seg: 8 });   // lattice anchor posts
  kit.colCyl([CX, 0.0, CZ], 0.6, 2.5);
  // top collar into the ceiling
  kit.lathe('trimDS', [[0.5, 0], [0.53, 0.025], [0.64, 0.12], [0.7, 0.2]], { pos: [CX, Y1, CZ], seg: 40 });
  kit.cyl('sciCabDk', [CX, Y1 + 0.02, CZ], 0.55, 0.04, { seg: 40 }); kit.torus('emitStrip', [CX, Y1 - 0.002, CZ], 0.505, 0.008, { seg: 56, tube: 5 });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; kit.beam('sciCabDk', [CX + Math.cos(a) * 0.52, Y1 + 0.06, CZ + Math.sin(a) * 0.52], [CX + Math.cos(a) * 0.82, CE - 0.04, CZ + Math.sin(a) * 0.82], 0.05, 0.05, { bev: 0.01 }); }
  kit.sign(eur ? 'THEA · HX-01' : 'LYRA · HX-02', [CX - 0.565, FL + 0.1, CZ], { w: 0.34, h: 0.07, rot: [0, -Math.PI / 2, 0], style: 'door' });
}

function conduits(kit) {
  const eur = kit.eur;
  for (const z of [14.62, 17.38]) {
    kit.cyl('sciSteel', [3.8, (FL + CE) / 2, z], 0.07, CE - FL, { seg: 14 });
    for (let y = FL + 0.35; y < CE - 0.2; y += 0.55) { kit.cyl(y > 0 ? 'paintOrange' : 'paintCyan', [3.8, y, z], 0.078, 0.07, { seg: 14 }); kit.torus('trim', [3.8, y + 0.055, z], 0.075, 0.01, { seg: 14, tube: 4 }); }
    kit.box('trim', [3.86, 0.2, z], [0.08, 0.5, 0.14], { bev: 0.01 }); kit.colCyl([3.8, 0, z], 0.09, 2.5);
  }
  kit.tube('sciSteel', [[3.8, FL + 0.07, 14.62], [3.35, FL + 0.06, 14.95], [3.0, FL + 0.06, 15.25], [CX + 0.5, FL + 0.12, 15.5]], 0.045, { rseg: 8 });
  kit.tube('sciSteel', [[3.8, FL + 0.07, 17.38], [3.35, FL + 0.06, 17.05], [3.0, FL + 0.06, 16.75], [CX + 0.5, FL + 0.12, 16.5]], 0.045, { rseg: 8 });
  kit.tube('paintCyan', [[CX + 0.45, CE - 0.1, CZ - 0.3], [3.2, CE - 0.1, 15.3], [3.75, CE - 0.1, 14.8], [3.8, CE - 0.3, 14.62]], 0.04, { rseg: 8 });
  kit.tube('paintOrange', [[CX + 0.45, CE - 0.1, CZ + 0.3], [3.2, CE - 0.1, 16.7], [3.75, CE - 0.1, 17.2], [3.8, CE - 0.3, 17.38]], 0.04, { rseg: 8 });
  if (eur) kit.box('sciIce', [3.8, FL + 0.01, 14.8], [0.5, 0.012, 0.35], { bev: 0, yaw: 0.4 });
}

function consoles(kit) {
  const eur = kit.eur, THREE = kit.THREE, rz = ZR.core, N = wall(kit, 'N', rz), Sw = wall(kit, 'S', rz);
  [[N, 2.35, 0, 'core.lyra.scr'], [Sw, 2.35, Math.PI, 'core.aux.scr']].forEach(([f, u, yaw, id], i) => {
    const main = i === 0;
    f.box('sciCabDk', u, FL + 0.4, 0.21, 1.3, 0.8, 0.42, { bev: 0.012 }); f.box('trim', u, FL + 0.05, 0.19, 1.24, 0.1, 0.36, { bev: 0.004 });
    f.box('white', u, FL + 0.82, 0.21, 1.34, 0.04, 0.46, { bev: 0.01 }); f.box('paintCyan', u, FL + 0.4, 0.425, 1.2, 0.012, 0.004, { bev: 0 });
    for (const s of [-1, 1]) f.box('white', u + s * 0.54, FL + 1.15, 0.12, 0.06, 0.62, 0.14, { bev: 0.01 });
    f.box('sciCabDk', u, FL + 1.3, 0.1, 1.2, 0.12, 0.1, { bev: 0.01 });
    for (let r = 0; r < 2; r++) for (let j = 0; j < 9; j++) f.box(eur ? ((j + r + i) % 3 === 0 ? kit.led('Red', 'Rand') : (j + r) % 3 === 1 ? kit.led('Amber', 'Rand') : 'screenOff') : kit.led(['Cyan', 'Green', 'Amber'][(i + j + r) % 3], (j + r) % 4 === 0 ? 'Blink' : ''), u - 0.5 + j * 0.125, FL + 0.855, 0.32 + r * 0.07, 0.03, 0.006, 0.03, { bev: 0 });
    const th = eul(THREE, yaw, eur ? -0.15 : -0.5), sp = f.pt(u, FL + 1.18, 0.07);
    kit.box('sciCabDk', sp, [0.76, 0.46, 0.04], { bev: 0.01, rot: th });
    kit.screen({
      id, pos: f.pt(u, FL + 1.18, 0.07 + 0.026 * (main ? 1 : 1)), rot: th, size: main ? [0.68, 0.4] : [0.68, 0.4], res: [340, 200], range: 10, interval: 0.1,
      draw: (g, W, H, t) => {
        const st = kit.state.mode, al = st === 'alert' || st === 'emergency';
        S.base(g, W, H, t, { title: main ? 'LYRA' : 'LATTICE', sub: main ? (al ? 'ALERT' : 'NOMINAL') : 'TELEMETRY', accent: al ? S.C.red : S.C.cy });
        if (main) {
          S.mono(g, al ? 'LYRA — ALERT' : 'LYRA — NOMINAL', W / 2, 60, 22, al ? S.C.red : S.C.ink, 'center', 700);
          g.strokeStyle = al ? S.C.red : S.C.cy; g.lineWidth = 2; g.beginPath(); for (let x = 14; x <= W - 14; x += 3) { const u = (x - 14) / (W - 28), a = Math.sin(u * 3.14159) * (18 + 14 * Math.sin(t * 1.3 + u * 6)), y = 108 + Math.sin(u * 28 + t * 4) * a; x === 14 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
          S.table(g, 18, 160, [['COHERENCE', '99.7 %'], ['CHANNELS', '12 / 12'], ['LATENCY', '0.4 ms']], { size: 12, gap: 4, colW: 100 }); S.ring(g, W - 62, 172, 22, 0.997, S.C.green, 5);
        } else {
          S.bars(g, 16, 50, W - 32, 50, Array.from({ length: 30 }, (_, k) => 0.3 + 0.55 * Math.abs(Math.sin(k * 0.8 + t * 0.9))));
          S.line(g, 16, 110, W - 32, 34, (u) => 0.5 + 0.35 * Math.sin(u * 14 - t * 2) * Math.sin(u * 3), S.C.amber, 80);
          S.table(g, 18, 170, [['COOLANT', '292.0 K'], ['FLUX', '4.2 GW'], ['NODES', '72 / 72']], { size: 12, gap: 4, colW: 90 });
        }
      },
    });
    f.col(u, FL + 0.4, 0.21, 1.34, 0.8, 0.46);
  });
}

export default function build(kit) {
  const eur = kit.eur, rz = ZR.core, W = wall(kit, 'W', rz), E = wall(kit, 'E', rz);
  plinth(kit); conduits(kit); consoles(kit);
  if (eur) thea(kit, CX, CZ); else lyra(kit, CX, CZ);
  // floor ring (hazard) around the plinth, ceiling radial accents
  kit.add('hazard', new kit.THREE.RingGeometry(0.66, 0.74, 48), { pos: [CX, FL + 0.004, CZ], rot: [-Math.PI / 2, 0, 0] });
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; kit.box('emitStrip', [CX + Math.cos(a) * 1.0, CE - 0.012, CZ + Math.sin(a) * 1.0], [0.4, 0.012, 0.026], { bev: 0, yaw: -a }); }
  kit.torus('emitStrip', [CX, CE - 0.015, CZ], 1.15, 0.01, { seg: 64, tube: 4 });
  W.sign(eur ? 'THEA CORE · OFFLINE' : 'LYRA CORE · LATTICE ACTIVE', 14.62, 0.58, 0.004, 0.8, 0.11, 'door'); W.sign('AUTHORISED CREW ONLY', 17.38, 0.58, 0.004, 0.8, 0.11, 'warn');
  E.sign('COOLANT · CRYO LOOP A', 16.0, 0.3, 0.004, 0.7, 0.09); E.box('emitStrip', 16.0, FL + 0.1, 0.012, 3.4, 0.016, 0.014, { bev: 0 });
  W.box('emitStrip', 15.0, FL + 0.1, 0.012, 1.0, 0.016, 0.014, { bev: 0 }); W.box('emitStrip', 17.1, FL + 0.1, 0.012, 1.6, 0.016, 0.014, { bev: 0 });
  if (eur) kit.interact({ id: 'eur.core', label: 'THEA core', pos: [CX - 0.75, -0.15, CZ], radius: 1.8, hit: { c: [CX, 0.1, CZ], s: [1.0, 2.5, 1.0] } });
  else kit.interact({ id: 'core.lyra', label: 'LYRA core', pos: [CX - 0.75, -0.15, CZ], radius: 1.8, hit: { c: [CX, 0.1, CZ], s: [1.0, 2.5, 1.0] } });
}
