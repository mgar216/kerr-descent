// GALLEY — aft wall units: tall fridge, nutrient dispenser (live screen), counter with food heater + upper cupboards, pantry shelves, spice rack,
// fire blanket, menu board. EURYDICE: fridge ajar, dispenser dead (auto), cupboard open, pantry nearly empty, ration packets on the deck.
import { Frame, screenIn } from './crew_util.js';
import * as S from './screens.js';

export default function galley2(kit) {
  const eur = kit.eur, art = kit.crewArt, PI = Math.PI, FL = -1.2, CT = -0.3;

  // aft counter (also closes the L-corner under the corridor run), heater unit, upper cupboards
  const A = new Frame(kit, [-1.96, 0, 13.6125]);
  A.box('trim', [0, FL + 0.05, -0.015], [1.34, 0.1, 0.58], { bev: 0.004 }); A.box('white', [0, -0.72, 0], [1.38, 0.76, 0.625], { bev: 0.01 }); A.box('wood', [0, CT - 0.02, 0], [1.4, 0.04, 0.645], { bev: 0.006 });
  for (const [x, w] of [[-0.35, 0.34], [0.0, 0.34]]) { A.box('plasticDark', [x - 0.19, -0.72, -0.3135], [w, 0.74, 0.015], { bev: 0.004 }); A.box('metal', [x - 0.19 + w / 2 - 0.04, -0.5, -0.328], [0.016, 0.2, 0.016], { bev: 0.004 }); }
  A.box('paintOrange', [0, -0.352, -0.318], [1.38, 0.014, 0.006], { bev: 0 });
  kit.colBox([-1.96, FL + 0.45, 13.6125], [1.38, 0.9, 0.625]);
  const Hm = new Frame(kit, [-2.35, CT, 13.62]);
  Hm.box('steel', [0, 0.15, 0], [0.5, 0.3, 0.4], { bev: 0.01 }); Hm.box('glassTint', [-0.06, 0.15, -0.203], [0.32, 0.22, 0.008], { bev: 0 }); Hm.box('plasticDark', [0.19, 0.15, -0.203], [0.1, 0.26, 0.008], { bev: 0.002 });
  Hm.box('metal', [-0.235, 0.15, -0.215], [0.012, 0.2, 0.02], { bev: 0.004 });
  if (!eur) { Hm.box('ledCyan', [0.19, 0.24, -0.208], [0.07, 0.025, 0.003], { bev: 0 }); for (let k = 0; k < 3; k++) Hm.cyl('metal', [0.17 + (k % 2) * 0.03, 0.17 - k * 0.04, -0.21], 0.01, 0.008, { axis: 'z', seg: 10 }); Hm.box(kit.led('Amber', 'Blink'), [0.2, 0.06, -0.207], [0.012, 0.012, 0.004], { bev: 0 }); }
  kit.sign('FOOD HEATER', Hm.P([0, 0.275, -0.206]), { w: 0.2, h: 0.03, rot: [0, PI, 0] });
  const Uc = new Frame(kit, [-2.235, 0.75, 13.75]);
  Uc.box('white', [0, 0, 0.0], [0.83, 0.9, 0.35], { bev: 0.01 }); Uc.box('emitWarm', [0, -0.455, -0.03], [0.7, 0.008, 0.2], { bev: 0 });
  for (const sx of [-1, 1]) { const open = eur && sx > 0, H = Uc.sub([sx * 0.41, 0, -0.175], open ? -sx * 1.8 : 0); H.box('plasticDark', [-sx * 0.2, 0, -0.008], [0.4, 0.88, 0.016], { bev: 0.004 }); H.box('metal', [-sx * 0.04, -0.3, -0.02], [0.016, 0.16, 0.016], { bev: 0.004 }); }
  if (eur) { Uc.box('metal', [0, 0.1, 0], [0.8, 0.012, 0.3], { bev: 0.002 }); for (const [x, y, r] of [[-0.2, 0.17, 0.2], [0.1, 0.17, -0.3], [-0.25, -0.2, 1]]) Uc.box(r > 0 ? 'paintOrange' : 'paintCyan', [x, y, 0], [0.12, 0.07, 0.15], { bev: 0.003, rot: [0, r, 0] }); }

  // tall fridge + nutrient dispenser
  const F = new Frame(kit, [-3.59, FL, 13.6]);
  F.box('white', [0, 0.925, 0], [0.58, 1.85, 0.64], { bev: 0.012 }); F.box('trim', [0, 0.01, -0.01], [0.54, 0.02, 0.6], { bev: 0.004 });
  const fd = F.sub([0.29, 0, -0.32], eur ? -1.15 : 0);
  fd.box('white', [-0.29, 0.55, -0.008], [0.57, 1.0, 0.016], { bev: 0.006 }); fd.box('metal', [-0.1, 0.55, -0.03], [0.014, 0.4, 0.02], { bev: 0.004 });
  if (eur) { F.box('rubber', [0, 0.55, -0.31], [0.52, 0.95, 0.02], { bev: 0 }); for (const y of [0.3, 0.6, 0.9]) F.box('metal', [0, y, -0.2], [0.5, 0.01, 0.2], { bev: 0 }); F.box('paintWhite', [-0.1, 0.33, -0.2], [0.14, 0.06, 0.12], { bev: 0.003 }); F.box('paintCyan', [0.12, 0.63, -0.2], [0.14, 0.06, 0.12], { bev: 0.003, rot: [0, 0.4, 0] }); }
  F.box('trim', [0, 1.1, -0.322], [0.58, 0.012, 0.006], { bev: 0 }); F.box('white', [0, 1.5, -0.322], [0.56, 0.7, 0.012], { bev: 0.004 }); F.box('metal', [0.2, 1.5, -0.335], [0.014, 0.22, 0.02], { bev: 0.004 });
  F.box('paintOrange', [0, 0.09, -0.322], [0.58, 0.035, 0.006], { bev: 0 }); F.box('plasticDark', [-0.12, 1.66, -0.332], [0.15, 0.08, 0.006], { bev: 0.002 });
  if (!eur) {
    F.box('ledCyan', [-0.12, 1.66, -0.336], [0.12, 0.012, 0.002], { bev: 0 }); kit.sign('COLD STORE · 4.0 °C', F.P([-0.12, 1.72, -0.334]), { w: 0.2, h: 0.04, rot: [0, PI, 0] });
    for (const [x, y, c, r] of [[0.02, 0.9, 'paintWhite', 0.1], [-0.12, 0.74, 'paintCyan', -0.15]]) F.box(c, [x, y, -0.331], [0.12, 0.09, 0.002], { bev: 0, rot: [0, 0, r] });
    for (const [x, y, c] of [[0.02, 0.945, 'paintOrange'], [-0.12, 0.785, 'paintOrange'], [0.1, 1.0, 'paintCyan']]) F.cyl(c, [x, y, -0.334], 0.01, 0.006, { axis: 'z', seg: 8 });
  }
  kit.colBox([-3.59, FL + 0.925, 13.6], [0.58, 1.85, 0.64]);

  const D = new Frame(kit, [-2.97, FL, 13.65]);
  D.box('white', [0, 0.9, 0], [0.62, 1.8, 0.5], { bev: 0.012 }); D.box('trim', [0, 0.01, -0.01], [0.58, 0.02, 0.46], { bev: 0.004 });
  D.box('plasticDark', [0, 1.34, -0.254], [0.56, 0.64, 0.008], { bev: 0.003 }); D.box('paintOrange', [0, 1.77, -0.254], [0.6, 0.03, 0.006], { bev: 0 }); D.box('paintOrange', [0, 0.45, -0.254], [0.6, 0.012, 0.006], { bev: 0 });
  D.box('trim', [0, 1.5, -0.262], [0.4, 0.24, 0.012], { bev: 0.004 });
  const SD = D.sub([0, 1.5, -0.27], PI);
  const items = [['1', 'BREAKFAST', 'oats + dried fruit'], ['2', 'LUNCH', 'lentil dal + rice'], ['3', 'DINNER', 'noodles + basil*'], ['4', 'PIZZA', "Mira's recipe"]];
  screenIn(kit, SD, [0, 0, 0], [0.36, 0.215], [384, 230], (g, W, H, t) => {
    const c = S.base(g, W, H, t, { title: 'GALLEY · NUTRIENT', sub: 'HX-02' }), sel = Math.floor(t / 4) % 4;
    items.forEach(([n, a, b], i) => { const y = c.y + 2 + i * 30; if (i === sel) { g.fillStyle = 'rgba(134,236,255,0.15)'; g.fillRect(c.x, y - 2, c.w, 28); } S.mono(g, n, c.x + 8, y + 18, 18, S.C.amber, 'left', 700); S.mono(g, a, c.x + 30, y + 18, 17, S.C.ink, 'left', 700); S.mono(g, b, c.x + c.w - 6, y + 18, 14, S.C.cyd, 'right'); });
    const hy = H - 24; S.mono(g, 'HEATER 74°C', c.x + 4, hy, 13, S.C.cyd); g.fillStyle = S.C.cyf; g.fillRect(c.x + 110, hy - 11, 120, 10); g.fillStyle = S.C.green; g.fillRect(c.x + 110, hy - 11, 60 + 50 * Math.sin(t * 0.6) * 0.5 + 25, 10);
  }, { id: 'galley.dispenser', range: 8 });
  D.box('plasticDark', [0, 0.82, -0.234], [0.4, 0.3, 0.04], { bev: 0.004 }); D.box(eur ? 'plasticDark' : 'emitWarm', [0, 0.97, -0.236], [0.36, 0.008, 0.03], { bev: 0 }); D.box('steel', [0, 0.665, -0.28], [0.4, 0.016, 0.1], { bev: 0.003 });
  for (const sx of [-1, 1]) D.cyl('metal', [sx * 0.08, 0.93, -0.25], 0.012, 0.04, { seg: 8 });
  for (let k = 0; k < 4; k++) { D.cyl('paintWhite', [0.235, 1.2 + k * 0.1 - 0.02, -0.262], 0.022, 0.012, { axis: 'z', seg: 12 }); }
  if (!eur) for (let k = 0; k < 4; k++) D.box(k === 3 ? kit.led('Amber', 'Blink') : kit.led('Green'), [0.235, 1.2 + k * 0.1 + 0.03, -0.262], [0.018, 0.006, 0.004], { bev: 0 });
  kit.sign('NUTRIENT DISPENSER', D.P([0, 1.7, -0.258]), { w: 0.42, h: 0.06, rot: [0, PI, 0] });
  D.box('paintCyan', [0, 0.55, -0.254], [0.3, 0.05, 0.004], { bev: 0 });
  kit.colBox([-2.97, FL + 0.9, 13.65], [0.62, 1.8, 0.5]);
  kit.sign('RECYCLER', D.P([0, 0.5, -0.258]), { w: 0.26, h: 0.04, rot: [0, PI, 0] });

  // pantry shelves on the outer wall (aft of the window)
  const P = new Frame(kit, [-3.8, 0, 12.7]);
  for (const y of [-0.5, 0.05, 0.6]) { P.box('wood', [0, y, 0], [0.25, 0.022, 1.2], { bev: 0.004 }); }
  for (const z of [-0.6, 0.6]) P.box('white', [0, 0.05, z], [0.24, 1.16, 0.02], { bev: 0.004 });
  if (!eur) {
    [-0.5, 0.05, 0.6].forEach((y, r) => { for (let k = 0; k < 4; k++) { const z = -0.45 + k * 0.28 + (r === 1 ? 0.05 : 0), c = [['glassMed', 'paintOrange'], ['steel', 'paintCyan'], ['crewFab', 'paintWhite'], ['paintOrange', 'trim']][(k + r) % 4];
      if (c[0] === 'glassMed') { P.cyl('glassMed', [0, y + 0.075, z], 0.05, 0.13, { seg: 12 }); P.cyl(c[1], [0, y + 0.145, z], 0.052, 0.02, { seg: 12 }); P.cyl('leather', [0, y + 0.06, z], 0.045, 0.1, { seg: 10 }); }
      else if (c[0] === 'steel') { P.cyl('steel', [0, y + 0.06, z], 0.045, 0.1, { seg: 12 }); P.cyl(c[1], [0, y + 0.06, z], 0.0465, 0.04, { seg: 12 }); }
      else P.box(c[0], [0, y + 0.1, z], [0.15, 0.18, 0.1], { bev: 0.015 }); } });
  } else { P.box('paintOrange', [0.0, 0.082, -0.3], [0.14, 0.14, 0.09], { bev: 0.003 }); P.box('paintCyan', [0.0, -0.43, 0.2], [0.12, 0.14, 0.09], { bev: 0.003, rot: [0, 0.2, 0] }); }

  // spice rack + fire blanket on the corridor wall (forward segment)
  const Sp = new Frame(kit, [-1.27, 0.12, 8.85], PI / 2);
  for (const y of [0, 0.2, 0.4]) Sp.box('wood', [0, y, -0.05], [0.84, 0.018, 0.1], { bev: 0.004 });
  for (const x of [-0.42, 0.42]) Sp.box('trim', [x, 0.2, -0.05], [0.016, 0.44, 0.1], { bev: 0.003 });
  if (!eur) [0, 0.2, 0.4].forEach((y, r) => { for (let k = 0; k < 6; k++) { const x = -0.34 + k * 0.136, lid = ['paintOrange', 'paintCyan', 'paintWhite', 'leather', 'leaf', 'paintOrange'][(k + r * 2) % 6]; Sp.cyl('glassMed', [x, y + 0.05, -0.055], 0.027, 0.08, { seg: 10 }); Sp.cyl(['leather', 'paintOrange', 'leather', 'leaf', 'brass', 'paintWhite'][(k * 3 + r) % 6], [x, y + 0.04, -0.055], 0.022, 0.056, { seg: 10 }); Sp.cyl(lid, [x, y + 0.096, -0.055], 0.028, 0.014, { seg: 10 }); } });
  kit.sign('SPICES', Sp.P([0, 0.52, -0.012]), { w: 0.2, h: 0.04, rot: [0, -PI / 2, 0] });
  const Fb = new Frame(kit, [-1.27, -0.12, 9.38], PI / 2);
  Fb.box('paintOrange', [0, 0, -0.04], [0.15, 0.26, 0.08], { bev: 0.01 }); Fb.box('trim', [0, 0.14, -0.04], [0.16, 0.014, 0.082], { bev: 0.003 }); for (const x of [-0.04, 0.04]) Fb.box('paintWhite', [x, -0.15, -0.04], [0.02, 0.06, 0.01], { bev: 0.002 });
  kit.sign('FIRE BLANKET', Fb.P([0, 0.03, -0.082]), { w: 0.13, h: 0.045, rot: [0, -PI / 2, 0] });

  // menu board above the bench (forward partition)
  const M = new Frame(kit, [-2.95, 0.38, 8.085], 0);
  M.box('trim', [0, 0, 0.006], [0.68, 0.52, 0.012], { bev: 0.003 }); art.put(M, 'menu', [0, 0, 0.0125], 0.64, 0.48);
  M.box('wood', [0, -0.275, 0.03], [0.5, 0.012, 0.04], { bev: 0.003 }); M.cyl('paintWhite', [-0.1, -0.262, 0.03], 0.006, 0.05, { axis: 'x', seg: 6 }); M.cyl('paintOrange', [0.0, -0.262, 0.03], 0.006, 0.04, { axis: 'x', seg: 6 });
}
