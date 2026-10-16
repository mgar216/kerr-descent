// SCIENCE LAB instruments (2/2): sample analyzer + centrifuge + trays, and the live black-hole WALL DISPLAY (lab.display).
import * as S from './screens.js';
import { wall, canvasTex, ZR, BT } from './science_util.js';

const VIAL = ['sciRed', 'paintCyan', 'paintOrange', 'sciTeal'];

function analyzer(kit, E) {
  const eur = kit.eur, R = kit.rand(0xa11a), u = 3.75, v = 0.31, h = 0.42;
  E.box('sciCab', u, BT + h / 2, v, 0.62, h, 0.5, { bev: 0.01 });
  E.box('trim', u, BT + h - 0.01, v, 0.64, 0.02, 0.52, { bev: 0.004 });
  E.box('paintCyan', u, BT + 0.012, 0.565, 0.6, 0.016, 0.004, { bev: 0 });
  for (let i = 0; i < 5; i++) E.box('trim', u + 0.31, BT + 0.1 + i * 0.05, v, 0.004, 0.012, 0.3, { bev: 0 });          // side vent slots
  E.box('trim', u, BT + 0.1, 0.563, 0.4, 0.055, 0.008, { bev: 0.002 });                                              // sample drawer slot
  E.box('sciSteel', u, BT + 0.108, eur ? 0.585 : 0.615, 0.36, 0.012, eur ? 0.05 : 0.11, { bev: 0.002 });             // tray (pulled out when alive)
  for (let i = 0; i < 12; i++) {
    const uu = u - 0.15 + (i % 6) * 0.06, vv = (eur ? 0.585 : 0.615) + (i < 6 ? -0.026 : 0.026);
    if (eur && i > 3) { E.box('sciIce', uu, BT + 0.114, vv + 0.04, 0.05, 0.006, 0.04, { bev: 0, yaw: R() * 3 }); continue; }
    E.cyl('sciGlass', uu, BT + 0.14, vv, 0.011, 0.05, { seg: 6 }); E.cyl(VIAL[i % 4], uu, BT + 0.169, vv, 0.012, 0.014, { seg: 6 });
  }
  E.box('sciSteel', u, BT + h + 0.012, v, 0.28, 0.01, 0.28, { bev: 0.003 });                                          // autosampler carousel
  E.cyl('sciSteel', u, BT + h + 0.03, v, 0.115, 0.03, { seg: 20 });
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; E.cyl('sciGlass', u + Math.cos(a) * 0.085, BT + h + 0.068, v + Math.sin(a) * 0.085, 0.009, 0.04, { seg: 6 }); }
  kit.sphere('sciGlass', E.pt(u, BT + h + 0.045, v), 0.13, { seg: 18, theta: Math.PI / 2, sy: 0.6 });
  E.sign('SAMPLE ANALYZER · SA-4', u, BT + h - 0.075, 0.566, 0.36, 0.055);
  E.box(kit.led(eur ? 'Red' : 'Green'), u + 0.25, BT + 0.3, 0.564, 0.02, 0.02, 0.004, { bev: 0 }); E.box(kit.led('Amber', eur ? '' : 'Blink'), u + 0.25, BT + 0.265, 0.564, 0.02, 0.02, 0.004, { bev: 0 });
  kit.screen({
    id: 'lab.analyzer.scr', pos: E.pt(u - 0.04, BT + 0.275, 0.569), rot: [0, -Math.PI / 2, 0], size: [0.3, 0.12], res: [240, 96], range: 8,
    draw: (g, W, H, t) => {
      S.base(g, W, H, t, { title: 'ANALYZER', sub: 'RUN 0417' });
      const p = (t * 0.04) % 1; g.fillStyle = S.C.cyf; g.fillRect(14, H - 22, W - 28, 8); g.fillStyle = S.C.cy; g.fillRect(14, H - 22, (W - 28) * p, 8);
      S.mono(g, `ANALYSING ${(p * 100).toFixed(0)}%`, 14, H - 30, 11, S.C.amber); S.bars(g, 14, 30, W - 28, 24, Array.from({ length: 28 }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin(i * 1.3 + t * 0.7) * Math.cos(i * 0.37))));
    },
  });
  // centrifuge
  const cu = 4.45, cv = 0.3;
  E.cyl('sciCab', cu, BT + 0.09, cv, 0.17, 0.18, { seg: 22 }); E.cyl('trim', cu, BT + 0.005, cv, 0.18, 0.01, { seg: 22 });
  kit.sphere('sciCabDk', E.pt(cu, BT + 0.18, cv), 0.17, { seg: 22, theta: Math.PI / 2, sy: 0.36 });
  E.box('sciCabDk', cu, BT + 0.07, cv + 0.172, 0.12, 0.08, 0.02, { bev: 0.004 }); E.box(eur ? 'screenOff' : 'emitCyan', cu - 0.02, BT + 0.08, cv + 0.184, 0.05, 0.02, 0.004, { bev: 0 });
  E.cyl('sciSteel', cu + 0.04, BT + 0.055, cv + 0.19, 0.01, 0.014, { seg: 8, axis: 'z' }); E.box(kit.led('Cyan', eur ? '' : 'Blink'), cu + 0.045, BT + 0.09, cv + 0.184, 0.012, 0.012, 0.004, { bev: 0 });
  // tray stack + vial rack beside the analyzer
  for (let i = 0; i < 3; i++) E.box('white', 3.27, BT + 0.007 + i * 0.015, 0.4, 0.2, 0.012, 0.3, { bev: 0.003, yaw: (eur ? 0.5 : 0.04) * (i - 1) });
  for (let i = 0; i < 18; i++) E.box('trim', 3.27 - 0.075 + (i % 6) * 0.03, BT + 0.037, 0.4 - 0.08 + Math.floor(i / 6) * 0.07, 0.016, 0.004, 0.016, { bev: 0 });
}

function display(kit, S2) {
  const eur = kit.eur, u = 2.4, y = 0.33, zs = ZR.lab[1] - 0.03;
  for (const s of [-1, 1]) { S2.box('trim', u + s * 0.84, y, 0.014, 0.05, 1.0, 0.028, { bev: 0.006 }); S2.box('trim', u, y + s * 0.485, 0.014, 1.72, 0.05, 0.028, { bev: 0.006 }); }
  S2.box('emitStrip', u, y - 0.468, 0.034, 1.58, 0.008, 0.004, { bev: 0 });
  for (let i = 0; i < 6; i++) S2.box(kit.led(['Green', 'Cyan', 'Amber', 'Green', 'Cyan', 'Green'][i], i === 2 ? 'Blink' : ''), u - 0.45 + i * 0.045, y - 0.532, 0.03, 0.016, 0.016, 0.004, { bev: 0 });
  S2.box('sciCabDk', u, y - 0.54, 0.02, 0.62, 0.05, 0.03, { bev: 0.006 });
  S2.sign('EREBUS · LIVE FEED', u + 0.4, y - 0.538, 0.037, 0.3, 0.045, 'door');
  S2.box('plasticDark', 2.4, BT + 0.006, 0.28, 0.4, 0.012, 0.14, { bev: 0.004 }); S2.box('plasticDark', 2.9, BT + 0.012, 0.3, 0.08, 0.024, 0.06, { bev: 0.008 });     // keyboard + trackball
  kit.screen({
    id: 'lab.display', pos: [u, y, zs], rot: [0, Math.PI, 0], size: [1.6, 0.9], res: [512, 288], range: 13, interval: 0.1,
    draw: (g, W, H, t) => {
      S.blackHole(g, 0, 0, W, H, t, { tilt: 0.26 + 0.03 * Math.sin(t * 0.2), label: false });
      g.fillStyle = 'rgba(2,10,16,0.6)'; g.fillRect(0, 0, W, 30); g.fillRect(0, H - 26, W, 26);
      S.mono(g, 'EREBUS · XRB-J1840', 14, 21, 17, S.C.cy, 'left', 700); S.mono(g, 'LIVE · CAM-DORSAL LONG-LENS', W - 14, 21, 12, S.C.cyd, 'right');
      if (Math.sin(t * 5) > 0) { g.fillStyle = '#ff4d6a'; g.beginPath(); g.arc(W - 20, 44, 4, 0, 6.283); g.fill(); }
      S.table(g, 14, 52, [['M', '2.03×10⁵ M☉'], ['a*', '0.95'], ['r₊', '1.312 M'], ['ISCO', '1.94 M']], { size: 12, gap: 4, colW: 42 });
      S.table(g, W - 150, 52, [['T_in', '4.1 MK'], ['ṁ', '0.031 Edd'], ['DOPPLER', '±0.34 c']], { size: 12, gap: 4, colW: 62 });
      const R = Math.min(W, H) * 0.2, cx = W / 2, cy = H / 2;
      g.strokeStyle = 'rgba(134,236,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R * 2.3, 0, 6.283); g.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * 0.05; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 2.3, cy + Math.sin(a) * R * 2.3); g.lineTo(cx + Math.cos(a) * R * 2.45, cy + Math.sin(a) * R * 2.45); g.stroke(); }
      S.mono(g, 'PHOTON RING 2.6 M', cx + R * 2.4, cy - R * 2.1, 11, S.C.cyd);
      S.mono(g, `SPIN AXIS +z · INCL 62° · HALCYON 46 M · t ${(t % 3600).toFixed(1)} s`, 14, H - 9, 11, S.C.cyd);
      S.bars(g, W - 112, H - 22, 98, 16, Array.from({ length: 14 }, (_, i) => 0.3 + 0.6 * Math.abs(Math.sin(i * 0.9 + t * 1.3))));
      g.fillStyle = 'rgba(0,0,0,0.13)'; for (let yy = 0; yy < H; yy += 3) g.fillRect(0, yy, W, 1);
    },
  });
  if (eur) {                                                                                      // cracked panel: radiating fractures from an impact point
    const tex = canvasTex(kit, 1024, 576, (g, W, H) => {
      const R = kit.rand(0xc4ac), ox = W * 0.62, oy = H * 0.4; g.clearRect(0, 0, W, H); g.lineCap = 'round';
      for (let i = 0; i < 22; i++) { let a = R() * 6.283, x = ox, y = oy; g.strokeStyle = `rgba(215,235,255,${0.45 + R() * 0.4})`; g.lineWidth = 1 + R() * 2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { a += (R() - 0.5) * 0.7; const l = 30 + R() * 90; x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y); } g.stroke(); }
      g.strokeStyle = 'rgba(230,245,255,0.5)'; g.lineWidth = 2; for (let r = 40; r < 200; r += 55) { g.beginPath(); g.arc(ox, oy, r, R() * 6, R() * 6 + 2.2); g.stroke(); }
    });
    kit.decal(tex, [u, y, zs - 0.004], [1.6, 0.9], { rot: [0, Math.PI, 0], opacity: 0.9, name: 'screen.crack' });
  }
  kit.interact({ id: 'lab.display', label: 'Wall display — Erebus (live)', pos: [u, 0.0, 9.3], radius: 2.0, hit: { c: [u, y, zs - 0.004], s: [1.7, 0.98, 0.05] } });
}

export default function build(kit) {
  const rz = ZR.lab;
  analyzer(kit, wall(kit, 'E', rz)); display(kit, wall(kit, 'S', rz));
}
