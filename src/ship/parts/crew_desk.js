// QUARTERS — desk against the outer wall: message terminal (quarters.terminal), photo frame (quarters.photo / eur.photo), chair, lamp, shelf with model + books.
// EURYDICE: dead terminal (kit.screen auto-dead), photo frame askew as `eur.photo`, chair turned away, drawer out, shelf mostly empty.
import { Frame, screenIn } from './crew_util.js';
import * as S from './screens.js';

export default function desk(kit) {
  const eur = kit.eur, FL = -1.2;
  const D = new Frame(kit, [-3.59, 0, 3.775]);                                 // desk centre (local x across, z along the outer wall)
  const TOPY = -0.46;

  // desk: top, pedestal with drawers (forward end), aft leg panel, cable tray
  D.box('wood', [0, TOPY - 0.0175, 0], [0.62, 0.035, 1.25], { bev: 0.008 }); D.box('trim', [0.307, TOPY - 0.0175, 0], [0.012, 0.037, 1.25], { bev: 0.003 });
  D.box('white', [-0.01, -0.8, -0.415], [0.58, 0.6, 0.41], { bev: 0.01 });
  [-0.64, -0.82, -1.0].forEach((y, i) => { const out = eur && i === 1 ? 0.26 : 0; if (out) { D.box('rubber', [0.281, y, -0.415], [0.004, 0.16, 0.36], { bev: 0 }); D.box('steel', [0.281 + out - 0.15, y - 0.03, -0.415], [0.3, 0.1, 0.34], { bev: 0 }); } D.box('steel', [0.283 + out, y, -0.415], [0.01, 0.165, 0.37], { bev: 0.003 }); D.box('trim', [0.295 + out, y + 0.05, -0.415], [0.018, 0.02, 0.16], { bev: 0.005 }); });
  D.box('wallDark', [0, -0.84, 0.605], [0.58, 0.72, 0.03], { bev: 0.006 }); D.box('trim', [-0.2, -0.56, 0.12], [0.3, 0.03, 0.78], { bev: 0.004 });
  kit.colBox([-3.59, -0.83, 3.775], [0.62, 0.74, 1.25]);

  // chair (turned away on EURYDICE)
  const C = new Frame(kit, [-2.78, FL, eur ? 4.0 : 3.82], eur ? Math.PI / 2 + 0.9 : Math.PI / 2);
  for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 + 0.3, x = Math.cos(a) * 0.27, z = Math.sin(a) * 0.27; C.beam('trim', [0, 0.07, 0], [x, 0.045, z], 0.04, 0.025, { bev: 0.004 }); C.cyl('rubber', [x, 0.025, z], 0.025, 0.05, { seg: 8 }); }
  C.cyl('trim', [0, 0.14, 0], 0.04, 0.14, { seg: 12 }); C.cyl('metal', [0, 0.3, 0], 0.027, 0.3, { seg: 10 });
  C.box('trim', [0, 0.44, 0], [0.42, 0.035, 0.42], { bev: 0.012 }); C.box('crewFabO', [0, 0.477, 0], [0.45, 0.07, 0.45], { bev: 0.032 });
  C.box('trim', [0, 0.56, 0.2], [0.05, 0.22, 0.03], { bev: 0.006 }); C.box('crewFabO', [0, 0.82, 0.235], [0.43, 0.42, 0.07], { bev: 0.03, rot: [0.1, 0, 0] });
  for (const s of [-1, 1]) { C.box('trim', [s * 0.245, 0.66, 0.0], [0.04, 0.03, 0.3], { bev: 0.008 }); C.box('trim', [s * 0.245, 0.55, 0.08], [0.03, 0.22, 0.03], { bev: 0.004 }); }
  kit.colCyl([C.P([0, 0, 0])[0], FL + 0.25, C.P([0, 0, 0])[2]], 0.24, 0.5);

  // message terminal: tilted monitor (faces +x), own bezel, stand, keyboard
  const M = new Frame(kit, [-3.665, -0.255, 3.99], [-0.2, Math.PI / 2, 0]);
  M.box('plasticDark', [0, 0, -0.024], [0.46, 0.3, 0.04], { bev: 0.012 });
  for (const s of [-1, 1]) { M.box('trim', [0, s * 0.135, -0.005], [0.44, 0.03, 0.016], { bev: 0.004 }); M.box('trim', [s * 0.21, 0, -0.005], [0.03, 0.25, 0.016], { bev: 0.004 }); }
  M.box(kit.led(eur ? 'Red' : 'Green'), [0.19, -0.142, 0.004], [0.012, 0.006, 0.004], { bev: 0 });
  D.box('plasticDark', [-0.06, TOPY + 0.006, 0.215], [0.16, 0.012, 0.24], { bev: 0.004 }); D.box('metal', [-0.08, TOPY + 0.04, 0.215], [0.03, 0.08, 0.06], { bev: 0.006 });
  const rows = [['MIRA', 'voice messages · 4 clips', 4], ['ELENA', 'archived · before the survey', 1], ['FD', 'go / no-go · descent window', 1], ['CAPCOM', 'J. Reyes · personal', 1]];
  const draw = (g, W, H, t) => {
    const c = S.base(g, W, H, t, { title: 'MESSAGES — 7 UNREAD', sub: 'HX-02' }), sel = Math.floor(t / 3.2) % 4;
    rows.forEach(([who, subj, n], i) => {
      const y = c.y + 6 + i * 56;
      if (i === sel) { g.fillStyle = 'rgba(134,236,255,0.14)'; g.fillRect(c.x, y - 6, c.w, 50); g.fillStyle = S.C.cy; g.fillRect(c.x, y - 6, 3, 50); }
      S.mono(g, i === sel ? '>' : '', c.x + 10, y + 24, 20, S.C.cy, 'left', 700);
      S.mono(g, who, c.x + 30, y + 24, 25, i === sel ? S.C.ink : S.C.cy, 'left', 700); S.mono(g, subj, c.x + 30, y + 42, 15, S.C.cyd);
      g.fillStyle = S.C.amber; g.beginPath(); g.arc(c.x + c.w - 26, y + 18, 15, 0, 6.283); g.fill(); S.mono(g, String(n), c.x + c.w - 26, y + 24, 19, '#1a1004', 'center', 700);
    });
    S.mono(g, '>', c.x + 4, H - 18, 20, S.C.green, 'left', 700); if (Math.floor(t * 2) % 2 === 0) { g.fillStyle = S.C.green; g.fillRect(c.x + 22, H - 33, 11, 18); }
    S.mono(g, 'ENTER  PLAY      ESC  CLOSE', W - 14, H - 18, 13, S.C.cyd, 'right');
  };
  screenIn(kit, M, [0, 0, 0.0015], [0.4, 0.25], [512, 320], draw, { id: 'quarters.terminal', range: 10 });
  D.box('plasticDark', [0.12, TOPY + 0.007, 0.2 + (eur ? 0.08 : 0)], [0.14, 0.014, 0.4], { bev: 0.004, rot: [0, eur ? 0.35 : 0, 0] });
  for (let k = 0; k < 4; k++) D.box('trim', [0.085 + k * 0.026, TOPY + 0.0145, 0.2 + (eur ? 0.08 : 0)], [0.012, 0.003, 0.36], { bev: 0, rot: [0, eur ? 0.35 : 0, 0] });
  if (!eur) kit.interact({ id: 'quarters.terminal', label: 'Message terminal', pos: [-3.62, -0.25, 3.99], radius: 1.7, hit: { c: [-3.7, -0.26, 3.99], s: [0.16, 0.34, 0.5] } });

  // photo frame (quarters.photo / eur.photo)
  const art = kit.crewArt;
  const P = new Frame(kit, [-3.7, TOPY, 3.43], [0, Math.PI / 2, eur ? 0.14 : 0]), PS = P.sub([0, 0.1, 0], [-0.18, 0, 0]);
  P.box('wood', [0, 0.065, -0.075], [0.05, 0.13, 0.012], { bev: 0.003, rot: [0.55, 0, 0] });
  PS.box('wood', [0, 0, 0], [0.25, 0.19, 0.018], { bev: 0.005 }); art.put(PS, 'photo', [0, 0, 0.0095], 0.205, 0.154);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) PS.box('brass', [sx * 0.118, sy * 0.088, 0.0095], [0.016, 0.016, 0.004], { bev: 0.001 });
  if (!eur) kit.interact({ id: 'quarters.photo', label: 'Photograph', pos: [-3.68, -0.36, 3.43], radius: 1.5, hit: { c: [-3.69, -0.36, 3.43], s: [0.14, 0.26, 0.3] } });   // EURYDICE: the photo `eur.photo` stands on the flight-deck console (derelict.js)

  // lamp (warm), desk clutter
  D.cyl('trim', [-0.22, TOPY + 0.008, 0.5], 0.06, 0.016, { seg: 16 }); D.tube('metal', [[-0.22, TOPY + 0.01, 0.5], [-0.22, TOPY + 0.2, 0.5], [-0.14, TOPY + 0.36, 0.46]], 0.008);
  D.cyl('white', [-0.12, TOPY + 0.38, 0.45], 0.02, 0.1, { rt: 0.02, rb: 0.075, seg: 16 }); D.cyl(eur ? 'paintWhite' : 'emitWarm', [-0.12, TOPY + 0.329, 0.45], 0.068, 0.004, { seg: 16 });
  if (!eur) {
    D.cyl('paintWhite', [0.2, TOPY + 0.045, -0.12], 0.04, 0.09, { seg: 16 }); D.tor('paintWhite', [0.238, TOPY + 0.045, -0.12], 0.026, 0.008, { axis: 'z', arc: Math.PI, rot: [0, 0, -Math.PI / 2], seg: 12 });
    D.box('plasticDark', [0.04, TOPY + 0.008, -0.0], [0.15, 0.012, 0.21], { bev: 0.006, rot: [0, 0.2, 0] }); D.box('screenOff', [0.04, TOPY + 0.0145, -0.0], [0.13, 0.002, 0.19], { bev: 0, rot: [0, 0.2, 0] });
    D.box('paintWhite', [-0.05, TOPY + 0.006, -0.25], [0.21, 0.01, 0.297], { bev: 0, rot: [0, 0.15, 0] }); D.box('paintOrange', [-0.05, TOPY + 0.013, -0.24], [0.12, 0.004, 0.2], { bev: 0, rot: [0, 0.4, 0] });
    D.cyl('metal', [-0.2, TOPY + 0.006, 0.0], 0.008, 0.15, { axis: 'z', seg: 6 });
  } else { D.box('plasticDark', [0.1, TOPY + 0.008, -0.13], [0.15, 0.012, 0.21], { bev: 0.006, rot: [0, 0.8, 0] }); D.cyl('paintWhite', [0.15, TOPY + 0.04, 0.05], 0.04, 0.09, { seg: 14, rot: [Math.PI / 2, 0, 0.5] }); }

  // wall shelf above the desk: ORPHEUS model on a stand, books, pen mug
  const SH = new Frame(kit, [-3.785, 0.12, 3.75]);
  SH.box('wood', [0, 0, 0], [0.23, 0.03, 1.1], { bev: 0.006 }); for (const z of [-0.4, 0.4]) SH.beam('trim', [0.0, -0.015, z], [0.0, -0.17, z], 0.02, 0.02, { bev: 0.003 });
  if (!eur) {
    [['paintOrange', 0.26, 0.04], ['leather', 0.22, 0.05], ['paintCyan', 0.25, 0.035], ['crewFab', 0.2, 0.045], ['paintWhite', 0.23, 0.03]].forEach(([m, h, w], i) => SH.box(m, [0, 0.015 + h / 2, -0.5 + i * 0.05 + (i === 4 ? 0.0 : 0)], [0.16, h, w], { bev: 0.004 }));
    SH.box('trim', [0, 0.04, 0.08], [0.1, 0.03, 0.22], { bev: 0.006 }); SH.box('trim', [0, 0.07, 0.08], [0.012, 0.04, 0.012], { bev: 0.002 });
    SH.cyl('white', [0, 0.115, 0.1], 0.02, 0.26, { axis: 'z', seg: 14 }); SH.cyl('white', [0, 0.115, -0.07], 0.02, 0.09, { rt: 0.02, rb: 0.001, axis: 'z', seg: 14 }); SH.sph('white', [0, 0.115, 0.1], [0.032, 0.03, 0.09], { seg: 10 });
    SH.cyl('paintOrange', [0, 0.115, 0.05], 0.0215, 0.03, { axis: 'z', seg: 14 }); SH.cyl('brass', [0, 0.115, 0.245], 0.026, 0.05, { rt: 0.03, rb: 0.014, axis: 'z', seg: 12 });
    for (const a of [0, 1, 2, 3]) SH.box('paintCyan', [Math.cos(a * 1.571 + 0.78) * 0.045, 0.115 + Math.sin(a * 1.571 + 0.78) * 0.045, 0.19], [0.05, 0.005, 0.07], { bev: 0, rot: [0, 0, a * 1.571 + 0.78] });
    SH.cyl('paintCyan', [0, 0.055, 0.42], 0.034, 0.08, { seg: 14 }); for (let k = 0; k < 3; k++) SH.cyl(k ? 'paintOrange' : 'rubber', [(k - 1) * 0.012, 0.12, 0.42 + (k - 1) * 0.01], 0.004, 0.09, { seg: 6, rot: [0.1 * (k - 1), 0, 0.12 * (k - 1)] });
  } else { SH.box('leather', [0, 0.14, -0.45], [0.16, 0.25, 0.04], { bev: 0.004, rot: [0, 0, 0.35] }); SH.box('paintCyan', [0, 0.02, -0.3], [0.16, 0.03, 0.2], { bev: 0.004, rot: [0, 0.2, 0] }); }
}
