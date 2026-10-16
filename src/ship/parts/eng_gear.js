// ENGINEERING — spare-parts lockers, switchgear + schematic display (forward bulkhead), parts bench, ladder + overhead hatch, floor hatch, signage.
import * as S from './screens.js';
import { frame } from './bay_util.js';

export default function gear(kit, E, D) {
  const L = kit.L, FLOOR = L.FLOOR, CEIL = L.CEIL, eur = kit.eur, ZF = E.ZF, ZA = E.ZA, W = frame(kit, [0, 0, 0], 0), R = kit.rand(0x6ea4);

  // ───────── spare-parts lockers beside the viewport (port) ─────────
  const names = ['SPARES · DRIVE', 'EVA REPAIR KIT', 'COOLANT CHEM'];
  [-3.27, -2.72, -2.17].forEach((x, i) => {
    const f = frame(kit, [x, FLOOR, ZA - 0.225], Math.PI), open = eur && i === 1;
    f.box('abCrateGrey', [0, 0.95, 0], [0.52, 1.9, 0.45], { bev: 0.01 });
    f.box('trim', [0, 0.06, 0.012], [0.54, 0.12, 0.46], { bev: 0.006 });
    f.box('trim', [0, 1.93, 0], [0.54, 0.05, 0.47], { bev: 0.006 });
    const door = (ang) => { const hx = -0.25; f.box('plastic', [hx + 0.25 * Math.cos(ang), 0.95, 0.228 + 0.25 * Math.sin(ang)], [0.5, 1.82, 0.02], { bev: 0.006, ry: -ang }); };
    if (open) {
      door(1.15);
      for (const y of [0.5, 1.0, 1.5]) f.box('steel', [0, y, 0], [0.46, 0.025, 0.4], { bev: 0.004 });
      f.box('abYellow', [0.0, 0.62, 0.0], [0.3, 0.2, 0.3], { bev: 0.01 }); f.box('plasticDark', [-0.05, 1.12, 0.02], [0.3, 0.2, 0.26], { bev: 0.01, ry: 0.2 });
    } else {
      f.box('plastic', [0, 0.95, 0.228], [0.5, 1.82, 0.02], { bev: 0.006 });
      for (let k = 0; k < 8; k++) f.box('trim', [0, 1.42 + k * 0.045, 0.24], [0.34, 0.012, 0.008], { bev: 0 });
      f.box('trim', [0.18, 0.95, 0.246], [0.03, 0.18, 0.03], { bev: 0.004 });
      f.box(kit.led(eur ? 'Red' : 'Green', i === 2 ? 'Blink' : ''), [0.18, 1.2, 0.241], [0.016, 0.016, 0.006], { bev: 0 });
      f.sign(names[i], [0, 1.2, 0.2395], { w: 0.4, h: 0.07, style: i === 2 ? 'warn' : 'plate' });
      f.box('paintOrange', [0, 0.25, 0.2395], [0.4, 0.05, 0.004], { bev: 0 });
    }
  });
  kit.colBox([-2.72, FLOOR + 0.95, ZA - 0.225], [1.65, 1.9, 0.46]);
  if (eur) for (let i = 0; i < 5; i++) W.box(i % 2 ? 'abYellow' : 'plasticDark', [-2.7 + R() * 0.5, FLOOR + 0.05, ZA - 0.65 + R() * 0.3], [0.16, 0.1, 0.2], { bev: 0.01, ry: R() * 3 });

  // ───────── switchgear (forward bulkhead) + schematic wall display ─────────
  [-2.95, -2.3, -1.65].forEach((x, i) => {
    const f = frame(kit, [x, FLOOR, ZF + 0.19], 0);
    f.box('abCrateGrey', [0, 1.0, 0], [0.6, 2.0, 0.38], { bev: 0.01 });
    f.box('trim', [0, 0.06, 0.0], [0.62, 0.12, 0.4], { bev: 0.006 });
    f.box('plasticDark', [0, 1.35, 0.192], [0.46, 0.6, 0.012], { bev: 0.004 });
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) f.box(kit.led(eur ? 'Red' : (r + c + i) % 5 === 0 ? 'Amber' : 'Green', (r * 3 + c + i) % 7 === 0 ? 'Rand' : ''), [-0.15 + c * 0.1, 1.55 - r * 0.1, 0.2], [0.026, 0.026, 0.006], { bev: 0 });
    f.box('trim', [0, 0.78, 0.194], [0.5, 0.012, 0.008], { bev: 0 });
    f.box('trim', [0.24, 0.5, 0.2], [0.03, 0.22, 0.03], { bev: 0.004 });
    f.sign(`DRIVE PWR ${i + 1}`, [0, 0.95, 0.2], { w: 0.4, h: 0.07, style: 'plate' });
    f.st('hv', [0, 0.3, 0.194], [0.14, 0.14], {});
    f.box('trim', [0, 2.06, 0.0], [0.3, 0.14, 0.3], { bev: 0.008 });
  });
  kit.colBox([-2.3, FLOOR + 1.0, ZF + 0.19], [1.95, 2.0, 0.4]);
  W.st('engw', [-0.4, 0.98, ZF + 0.004], [1.4, 0.31], {});
  { const sw = 1.5, sh = 0.84; W.box('trim', [-0.4, 0.14, ZF + 0.014], [sw + 0.1, sh + 0.1, 0.028], { bev: 0.008 }); W.box('paintOrange', [-0.4, 0.14 - sh / 2 - 0.045, ZF + 0.03], [sw + 0.1, 0.014, 0.004], { bev: 0 });
    kit.screen({ id: 'eng.schematic', pos: [-0.4, 0.14, ZF + 0.03], rot: [0, 0, 0], size: [sw, sh], res: [480, 270], range: 11, bezel: false, draw: (g, w, h, t) => drawSchematic(g, w, h, t, D) }); }

  // ───────── parts bench (aft starboard) with shelves + bins ─────────
  {
    const f = frame(kit, [2.85, FLOOR, ZA - 0.3], Math.PI);
    f.box('abCrateGrey', [0, 0.4, 0], [1.2, 0.8, 0.52], { bev: 0.01 });
    f.box('steel', [0, 0.825, 0], [1.26, 0.05, 0.58], { bev: 0.008 });
    for (let i = 0; i < 3; i++) { f.box('plastic', [0.2, 0.64 - i * 0.2, 0.262], [0.7, 0.17, 0.008], { bev: 0.003 }); f.box('trim', [0.2, 0.64 - i * 0.2, 0.27], [0.2, 0.018, 0.012], { bev: 0.003 }); }
    f.box('trim', [-0.4, 0.4, 0.264], [0.3, 0.7, 0.008], { bev: 0.003 });
    f.box('trim', [0.45, 0.93, 0.0], [0.15, 0.1, 0.14], { bev: 0.006 }); f.box('steel', [0.45, 1.0, 0.0], [0.07, 0.05, 0.04], { bev: 0.004 });
    f.box('abYellow', [-0.3, 0.92, 0.0], [0.28, 0.1, 0.18], { bev: 0.012 }); f.box('paintCyan', [0.05, 0.9, 0.05], [0.18, 0.06, 0.12], { bev: 0.01 });
    f.cyl('trim', [-0.05, 0.9, -0.1], 0.03, 0.06, { seg: 10 });
    if (!eur) { f.cyl('abBlue', [0.25, 0.97, 0.15], 0.032, 0.2, { seg: 12 }); f.cyl('trim', [0.25, 1.08, 0.15], 0.028, 0.03, { seg: 12 }); f.box('fabricGrey', [-0.15, 0.86, 0.2], [0.12, 0.02, 0.07], { bev: 0.006, ry: 0.5 }); f.cyl('wood', [0.05, 0.875, 0.22], 0.025, 0.5, { axis: 'x', seg: 8 }); }
    for (const y of [1.25, 1.65]) { f.box('steel', [0, y, -0.14], [1.2, 0.03, 0.3], { bev: 0.004 }); }
    ['abYellow', 'abBlue', 'abCrateOlive', 'paintOrange', 'abCrateTan', 'abGreen'].forEach((m, k) => { f.box(m, [-0.5 + (k % 3) * 0.38, 1.25 + 0.12 + Math.floor(k / 3) * 0.4, -0.14], [0.3, 0.2, 0.25], { bev: 0.012 }); f.box('plastic', [-0.5 + (k % 3) * 0.38, 1.25 + 0.15 + Math.floor(k / 3) * 0.4, -0.01], [0.2, 0.05, 0.006], { bev: 0 }); });
    f.col([0, 0.5, 0], [1.24, 1.0, 0.56]);
    f.sign('PARTS BENCH · ENG-3', [0, 1.97, -0.28], { w: 0.7, h: 0.09, style: 'plate' });
  }

  // ───────── port-wall ladder to the overhead service hatch ─────────
  {
    const lz = 36.35, lx = -3.47, top = CEIL - 0.22;
    for (const dz of [-0.22, 0.22]) W.cyl('abYellow', [lx, (FLOOR + top) / 2, lz + dz], 0.019, top - FLOOR, { seg: 8 });
    for (let y = FLOOR + 0.2; y < top; y += 0.26) W.cyl('steel', [lx, y, lz], 0.013, 0.44, { axis: 'z', seg: 6 });
    for (const y of [FLOOR + 0.4, 0.2]) for (const dz of [-0.22, 0.22]) W.box('trim', [lx - 0.025, y, lz + dz], [0.05, 0.05, 0.05], { bev: 0.004 });
    const hx = -3.0;
    W.cyl('trim', [hx, CEIL - 0.025, lz], 0.45, 0.05, { seg: 32 });
    W.cyl('hazard', [hx, CEIL - 0.055, lz], 0.4, 0.012, { seg: 32 });
    W.cyl('steel', [hx, CEIL - 0.066, lz], 0.3, 0.02, { seg: 28 });
    W.torus('abRed', [hx, CEIL - 0.09, lz], 0.1, 0.014, { axis: 'y', tube: 5, seg: 16 }); W.cyl('abRed', [hx, CEIL - 0.082, lz], 0.025, 0.03, { seg: 8 });
    kit.sign('DRIVE SERVICE HATCH', [-3.512, 0.55, lz], { w: 0.5, h: 0.09, style: 'warn', rot: [0, Math.PI / 2, 0] });
    kit.sign('LADDER', [-3.512, 0.18, lz + 0.35], { w: 0.2, h: 0.06, style: 'plate', rot: [0, Math.PI / 2, 0] });
    // floor hatch: sub-deck access
    const fx = -2.2, fz = 36.1;
    W.box('darkMetal', [fx, FLOOR + 0.011, fz], [0.8, 0.022, 0.8], { bev: 0.003 });
    for (const [dx, dz, sx, sz] of [[0, -0.4, 0.88, 0.08], [0, 0.4, 0.88, 0.08], [-0.4, 0, 0.08, 0.72], [0.4, 0, 0.08, 0.72]]) W.box('hazard', [fx + dx, FLOOR + 0.014, fz + dz], [sx, 0.012, sz], { bev: 0 });
    for (const dz of [-0.14, 0.14]) W.box('trim', [fx, FLOOR + 0.026, fz + dz], [0.22, 0.012, 0.05], { bev: 0.003 });
    W.box('steel', [fx - 0.34, FLOOR + 0.03, fz], [0.05, 0.02, 0.2], { bev: 0.004 });
    kit.sign('SUB-DECK ACCESS', [fx, FLOOR + 0.0225, fz - 0.55], { w: 0.62, h: 0.08, style: 'warn', rot: [-Math.PI / 2, 0, Math.PI] });
  }

  // ───────── door-side hazard marking + starboard wall stencil ─────────
  W.box('hazard', [1.58, 0.0, ZF + 0.004], [0.14, 2.2, 0.008], { bev: 0 });
  W.box('hazard', [2.4, FLOOR + 0.012, ZF + 0.36], [1.1, 0.012, 0.5], { bev: 0 });
  W.st('engw', [E.WX - 0.004, 1.05, 34.3], [1.5, 0.33], { ry: -Math.PI / 2 });
  W.st(eur ? 'eur1' : 'hx', [E.WX - 0.004, 0.86, 36.95], [0.5, 0.19], { ry: -Math.PI / 2 });
}

function drawSchematic(g, w, h, t, D) {
  const C = S.C, r = S.base(g, w, h, t, { title: 'DRIVE TOPOLOGY', sub: 'TORCH-1 · D–He³' }), lvl = Math.min(1, D.lvl), hot = lvl > 0.04;
  const col = hot ? C.amber : C.cy, y1 = r.y + 50, y2 = r.y + 150;
  const node = (x, y, ww, hh, label, c) => { g.strokeStyle = c; g.lineWidth = 2; g.strokeRect(x, y, ww, hh); g.fillStyle = 'rgba(134,236,255,0.07)'; g.fillRect(x, y, ww, hh); S.mono(g, label, x + ww / 2, y + hh / 2 + 5, 13, c, 'center', 700); };
  const flow = (x0, ya, x1, yb, c, sp) => { g.save(); g.strokeStyle = c; g.lineWidth = 3; g.setLineDash([10, 8]); g.lineDashOffset = -t * 34 * sp; g.beginPath(); g.moveTo(x0, ya); g.lineTo(x1, yb); g.stroke(); g.restore(); };
  node(20, y1, 84, 44, 'He-3 TANK', C.cy); node(20, y2, 84, 44, 'LN2 TANK', C.cy);
  flow(104, y1 + 22, 150, y1 + 22, C.cy, 0.6 + lvl); flow(104, y2 + 22, 150, y2 + 22, C.cy, 0.6 + lvl);
  node(150, y1, 70, 44, 'INJECT', col); node(150, y2, 70, 44, 'PUMP A', C.cy);
  flow(220, y1 + 22, 262, y1 + 22, col, 0.8 + 2 * lvl); flow(220, y2 + 22, 262, y2 + 22, C.cy, 0.6 + lvl);
  g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.ellipse(310, y1 + 78, 46, 46, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = hot ? '#ffd9a0' : C.cyd; g.lineWidth = 6; g.beginPath(); g.ellipse(310, y1 + 78, 46, 46, 0, t * (0.5 + 3 * lvl), t * (0.5 + 3 * lvl) + 2.2); g.stroke();
  S.mono(g, 'TORUS', 310, y1 + 83, 14, C.ink, 'center', 700);
  flow(356, y1 + 78, 410, y1 + 78, col, 1 + 3 * lvl); node(410, y1 + 56, 52, 44, 'CHBR', col);
  S.mono(g, 'OUTPUT ' + (0.4 + 11.6 * lvl).toFixed(1) + ' TW', 20, h - 56, 15, C.ink, 'left', 700);
  S.mono(g, 'FIELD ' + (7.9 + 1.6 * lvl).toFixed(2) + ' T', 20, h - 34, 15, C.cy, 'left'); S.mono(g, hot ? 'STATE: BURN ' + Math.round(lvl * 100) + '%' : 'STATE: STANDBY — PLASMA IDLE', w - 20, h - 34, 15, hot ? C.amber : C.green, 'right', 700);
  S.bars(g, w - 150, h - 78, 130, 18, [0.3, 0.4, 0.2 + lvl * 0.7, 0.5, 0.3 + lvl * 0.6, 0.45, 0.2 + lvl * 0.5], col);
}
