// SCIENCE LAB props: whiteboard (Kerr equations / Tomas's half-erased maths), glassware, racks, sink, microscope, reagent bottles, floor markings.
import { canvasTex, FL, BT } from './science_util.js';

const FLASK = [[0, 0], [0.04, 0], [0.05, 0.004], [0.05, 0.014], [0.032, 0.062], [0.014, 0.104], [0.014, 0.118], [0.019, 0.121], [0.019, 0.126]];
const FLASK_L = [[0, 0.004], [0.047, 0.004], [0.047, 0.014], [0.036, 0.04], [0, 0.04]];

function drawBoard(g, W, H, eur, R) {
  g.clearRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
  const hand = "'Segoe Print','Bradley Hand ITC','Comic Sans MS',cursive";
  const tx = (s, x, y, sz, c, rot = 0) => { g.save(); g.translate(x, y + (R() - 0.5) * 3); g.rotate(rot + (R() - 0.5) * 0.02); g.font = `${sz}px ${hand}`; g.fillStyle = c; g.fillText(s, 0, 0); g.restore(); };
  const bl = '#16284a', rd = '#8f1d1d', bk = '#121212', gn = '#14522e';
  tx('Kerr:  a* = 0.95   M = 2.03×10⁵ M☉', 36, 64, 40, bk);
  tx('Δ = r² − 2Mr + a²', 40, 126, 38, bl);
  tx('r± = M ± √(M² − a²)  →  1.312 / 0.688', 40, 184, 36, bl);
  tx('Ω_H = a / 2Mr₊      ISCO ≈ 1.94 M', 40, 240, 36, bl);
  tx('ergo: r = M + √(M² − a²cos²θ)', 40, 296, 34, gn);
  // sketch: hole + disk + infall path
  g.strokeStyle = bk; g.lineWidth = 4; g.beginPath(); g.arc(790, 150, 42, 0, 6.283); g.stroke(); g.fillStyle = bk; g.beginPath(); g.arc(790, 150, 42, 0, 6.283); g.fill();
  g.strokeStyle = rd; g.lineWidth = 3.5; g.beginPath(); g.ellipse(790, 152, 150, 30, -0.12, 0, 6.283); g.stroke();
  g.strokeStyle = bl; g.setLineDash([9, 8]); g.beginPath(); g.ellipse(790, 150, 100, 78, 0, 0, 6.283); g.stroke(); g.setLineDash([]);
  g.strokeStyle = gn; g.lineWidth = 4; g.beginPath(); g.moveTo(560, 70); g.bezierCurveTo(640, 90, 700, 40, 760, 110); g.bezierCurveTo(780, 135, 790, 150, 790, 150); g.stroke();
  g.beginPath(); g.moveTo(560, 70); g.lineTo(582, 52); g.moveTo(560, 70); g.lineTo(586, 82); g.stroke();
  tx('ORPHEUS', 540, 40, 30, gn); tx('r₊', 842, 112, 30, bk); tx('ergosphere', 884, 232, 28, bl); tx('disk', 910, 120, 28, rd);
  tx('tidal  ΔF ≈ 2GMℓ / r³  ∝ 1/M²', 40, 380, 40, bk);
  tx('BIG hole = GENTLE hole', 50, 440, 52, rd, -0.012);
  g.strokeStyle = rd; g.lineWidth = 4; g.beginPath(); g.moveTo(50, 456); g.quadraticCurveTo(300, 474, 540, 452); g.stroke();
  tx('☐ recalibrate gravimeter', 40, 540, 36, bk); tx('☐ spectra log → LYRA', 40, 590, 36, bk); tx('☑ stow samples', 520, 540, 36, gn);
  if (!eur) { g.fillStyle = '#f2d84a'; g.fillRect(790, 430, 190, 150); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(790, 568, 190, 12); tx('call Mira', 812, 490, 40, bk, -0.05); tx('before undock ♥', 806, 540, 32, rd, -0.05); }
  if (eur) {                                                                                       // half-erased, then Tomas's later notes
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(0,0,0,${0.45 + R() * 0.4})`; g.lineWidth = 46 + R() * 40; g.beginPath(); const y = 20 + R() * 320, x = R() * 500; g.moveTo(x, y); g.lineTo(x + 380 + R() * 380, y + (R() - 0.5) * 80); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(150,150,150,${0.05 + R() * 0.07})`; g.fillRect(R() * W, R() * 330, 40 + R() * 120, 3 + R() * 6); }   // smears
    tx('ring ≠ singularity !!', 540, 330, 40, rd, -0.03); tx('r = 0, θ = π/2 …  walk THROUGH', 520, 380, 30, bl);
    tx('water 38 d   O₂ 61 %', 40, 480, 36, bk); tx('food: 214 d ÷ 2 = 107 d', 40, 545, 36, bk); tx('— T.O.', 860, 600, 32, bl);
  }
}

export default function props(kit, fr) {
  const eur = kit.eur, R = kit.rand(0x5c1b), { E, W, N } = fr;
  // ───────── whiteboard (north wall) ─────────
  {
    const u = 2.5, y = 0.22, w = 1.4, h = 0.9;
    N.box('white', u, y, 0.012, w, h, 0.024, { bev: 0.004 });
    for (const s of [-1, 1]) { N.box('trim', u + s * (w / 2 + 0.012), y, 0.016, 0.024, h + 0.05, 0.032, { bev: 0.004 }); N.box('trim', u, y + s * (h / 2 + 0.012), 0.016, w + 0.05, 0.024, 0.032, { bev: 0.004 }); }
    N.box('sciSteel', u, y - h / 2 - 0.035, 0.035, 1.0, 0.02, 0.06, { bev: 0.004 });
    [['sciRed', 0.2], ['paintCyan', 0.27], ['sciTeal', 0.34]].forEach(([m, d]) => N.cylU(m, u + 0.2 + d - 0.2, y - h / 2 - 0.018, 0.04, 0.009, 0.12, { seg: 8 }));
    N.box('sciCabDk', u - 0.3, y - h / 2 - 0.012, 0.045, 0.14, 0.03, 0.05, { bev: 0.004 });
    const tex = canvasTex(kit, 1024, 640, (g, W2, H2) => drawBoard(g, W2, H2, eur, kit.rand(eur ? 0x77 : 0x33)));
    kit.decal(tex, N.pt(u, y, 0.027), [w - 0.04, h - 0.04], { rot: [0, 0, 0], opacity: eur ? 0.78 : 0.95, name: 'whiteboard' });
  }
  // ───────── glassware ─────────
  const flask = (f, u, y, v, k = 1, liq = true) => {
    kit.lathe('sciGlass', FLASK, { pos: f.pt(u, y, v), scale: [k, k, k], seg: 14 });
    if (liq && !eur) kit.lathe('liquid', FLASK_L, { pos: f.pt(u, y, v), scale: [k, k, k], seg: 14 });
  };
  const beaker = (f, u, y, v, r, h) => { f.cyl('sciGlass', u, y + h / 2, v, r, h, { seg: 14, open: true }); f.cyl('sciGlass', u, y + 0.003, v, r, 0.006, { seg: 14 }); if (!eur) f.cyl('liquid', u, y + h * 0.3, v, r * 0.96, h * 0.55, { seg: 14 }); };
  const rack = (f, u, y, v) => {                                                                 // test-tube rack
    f.box('plasticDark', u, y + 0.012, v, 0.3, 0.024, 0.07, { bev: 0.004 }); f.box('plasticDark', u, y + 0.07, v, 0.3, 0.012, 0.07, { bev: 0.003 });
    for (let i = 0; i < 7; i++) { const x = u - 0.12 + i * 0.04; f.cyl('sciGlass', x, y + 0.075, v, 0.009, 0.12, { seg: 6 }); f.cyl(['sciRed', 'paintCyan', 'paintOrange', 'sciTeal'][i % 4], x, y + 0.14, v, 0.011, 0.016, { seg: 6 }); }
  };
  const bottle = (f, u, y, v, h, cap) => { f.cyl('sciSteel', u, y + h / 2, v, 0.034, h, { seg: 10 }); f.cyl(cap, u, y + h + 0.012, v, 0.02, 0.024, { seg: 8 }); };
  // wet bench (corridor side, z 6.05..8.5): sink, flasks, racks
  {
    const y = BT, v = 0.3;
    W.box('sciSteel', 7.2, y + 0.012, v, 0.56, 0.024, 0.42, { bev: 0.004 }); W.box('trim', 7.2, y + 0.026, v, 0.5, 0.006, 0.36, { bev: 0.002 });
    W.cyl('trim', 7.2, y + 0.032, v, 0.025, 0.006, { seg: 12 });
    kit.tube('sciSteel', [W.pt(7.2, y + 0.02, 0.1), W.pt(7.2, y + 0.3, 0.1), W.pt(7.2, y + 0.4, 0.17), W.pt(7.2, y + 0.33, 0.3)], 0.013, { rseg: 6 });
    if (!eur) {
      flask(W, 6.4, y, 0.3); flask(W, 6.6, y, 0.34, 0.8); beaker(W, 6.25, y, 0.2, 0.04, 0.09); rack(W, 8.1, y, 0.3); bottle(W, 7.85, y, 0.46, 0.15, 'paintOrange');
      W.cyl('white', 6.2, y + 0.045, 0.46, 0.04, 0.09, { seg: 14 }); kit.torus('white', W.pt(6.245, y + 0.05, 0.46), 0.02, 0.005, { axis: 'x', tube: 5, seg: 10 });   // mug
    } else { flask(W, 6.4, y, 0.3, 1, false); rack(W, 8.1, y, 0.3); W.box('sciIce', 7.2, y + 0.034, v, 0.4, 0.008, 0.3, { bev: 0 }); }
  }
  // shelves: bottles and boxes
  for (const [y, n] of [[0.32, 6], [0.78, 5]]) for (let i = 0; i < n; i++) {
    const u = 6.3 + i * 0.4 + R() * 0.05;
    if (i % 3 === 2) W.box('white', u, y + 0.07, 0.12, 0.2, 0.13, 0.15, { bev: 0.004 }), W.box(i % 2 ? 'sciRed' : 'paintOrange', u, y + 0.07, 0.196, 0.12, 0.05, 0.004, { bev: 0 });
    else bottle(W, u, y + 0.012, 0.11, 0.12 + R() * 0.06, ['paintOrange', 'paintCyan', 'sciTeal', 'sciRed'][i % 4]);
  }
  // microscope + notebooks on the aft outer bench
  {
    const u = 8.25, v = 0.33, y = BT;
    E.box('sciCabDk', u, y + 0.02, v, 0.2, 0.04, 0.26, { bev: 0.008 }); E.box('sciSteel', u, y + 0.15, v + 0.08, 0.05, 0.22, 0.05, { bev: 0.006 });
    E.beam('sciSteel', [u, y + 0.24, v + 0.08], [u, y + 0.3, v - 0.04], 0.045, 0.045, { bev: 0.008 });
    E.cylV('sciCabDk', u, y + 0.28, v - 0.02, 0.026, 0.2, { seg: 12 }); E.cylV('sciSteel', u, y + 0.3, v - 0.15, 0.018, 0.08, { seg: 12 });
    E.cyl('sciSteel', u, y + 0.2, v - 0.02, 0.02, 0.05, { seg: 10 }); E.box('sciCabDk', u, y + 0.115, v - 0.02, 0.15, 0.012, 0.13, { bev: 0.003 });
    E.box(eur ? 'screenOff' : 'emitPanel', u, y + 0.065, v - 0.02, 0.05, 0.01, 0.05, { bev: 0 });
    E.box('white', u + 0.35, y + 0.02, 0.3, 0.22, 0.03, 0.3, { bev: 0.004, yaw: 0.15 }); E.box('paintCyan', u + 0.35, y + 0.038, 0.3, 0.2, 0.006, 0.28, { bev: 0, yaw: 0.15 });
  }
  // glassware on the analyzer bench end + spill in the derelict
  if (!eur) { rack(E, 3.35, BT, 0.12); beaker(E, 4.5, BT, 0.12, 0.045, 0.1); flask(E, 4.65, BT, 0.12, 0.9); }
  else {
    for (const [u, v, a, b] of [[4.2, 0.3, 0.5, 0.3], [4.7, 0.18, 0.3, 0.16], [3.6, 0.45, 0.2, 0.2]]) E.box('sciIce', u, BT + 0.004, v, a, 0.008, b, { bev: 0, yaw: R() });
    for (let i = 0; i < 5; i++) E.box('sciGlass', 3.9 + R() * 0.7, BT + 0.012, 0.15 + R() * 0.3, 0.04 + R() * 0.04, 0.006, 0.03, { bev: 0, yaw: R() * 3 });
    kit.box('sciIce', [2.45, FL + 0.003, 8.9], [0.9, 0.006, 0.6], { bev: 0, yaw: 0.4 }); kit.box('sciIce', [3.0, FL + 0.003, 7.6], [0.5, 0.006, 0.35], { bev: 0, yaw: 1.2 });
    kit.recorder(4, [1.58, BT + 0.025, 7.7], 0.6);
  }
  // vibration-isolation zone marking around the gravimeter (centre 3.3, 7.25)
  for (const s of [-1, 1]) { kit.box('hazard', [3.3 + s * 0.58, FL + 0.004, 7.25], [0.07, 0.008, 1.2], { bev: 0 }); kit.box('hazard', [3.3, FL + 0.004, 7.25 + s * 0.58], [1.2, 0.008, 0.07], { bev: 0 }); }
  // compressed-gas cylinders strapped to the corridor wall (aft corner)
  [[9.58, 0.11, 'paintCyan', 'N₂'], [9.76, 0.12, 'paintOrange', 'He']].forEach(([u, v, band, tag]) => {
    W.cyl('sciSteel', u, FL + 0.55, v, 0.075, 1.1, { seg: 14 }); kit.sphere('sciSteel', W.pt(u, FL + 1.1, v), 0.075, { seg: 14, theta: Math.PI / 2 });
    W.cyl(band, u, FL + 0.95, v, 0.0765, 0.26, { seg: 14 }); W.cyl('trim', u, FL + 0.02, v, 0.085, 0.04, { seg: 14 });
    W.cyl('brass', u, FL + 1.2, v, 0.02, 0.09, { seg: 8 }); W.box('brass', u, FL + 1.24, v, 0.1, 0.03, 0.03, { bev: 0.004 });
    kit.colCyl(W.pt(u, FL + 0.55, v), 0.09, 1.1);
  });
  W.box('trim', 9.67, FL + 0.8, 0.03, 0.36, 0.025, 0.02, { bev: 0.004 }); W.box('trim', 9.67, FL + 0.35, 0.03, 0.36, 0.025, 0.02, { bev: 0.004 });
  W.sign('GAS · N2 / HE', 9.67, FL + 1.42, 0.004, 0.34, 0.07, 'warn');
}
