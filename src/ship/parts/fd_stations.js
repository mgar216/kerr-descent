// Flight deck crew stations on the diagonal flare walls: systems console + avionics rack (starboard), nav console + rack + jump stool (port).
import { makeDraws } from './fd_screens.js';

const PI = Math.PI, DESK = -0.576;
export default function build(kit, U) {
  const { box, cyl, torus, sign, at, frame, led, tile, toggle, rocker, knob, vent, screws4, tube, diag, gauge } = U;
  const eur = kit.eur, D = makeDraws(kit), FLOOR = kit.L.FLOOR;
  const SB = diag(1), PT = diag(-1);
  U.sb = { W: SB, DESK };

  // console on wall W between lx0..lx1: cabinet + drawers, desk with keyboard, screen housing with n screens, header rack
  const consoleAt = (W, lx0, lx1, cfg) => {
    const w = lx1 - lx0, cx = (lx0 + lx1) / 2, C = W.fr(cx, 0, 0), TOP = at(C, [0, DESK, 0], { rot: [-PI / 2, 0, 0] });
    box(C, 'fdShell', [0, -0.91, 0.065], [w, 0.58, 0.13], { bev: 0.008 }); box(C, 'trim', [0, -1.165, 0.075], [w, 0.07, 0.15], { bev: 0.004 }); box(C, 'emitStrip', [0, -1.188, 0.153], [w - 0.06, 0.012, 0.006], { bev: 0 });
    const dw = w / 3;
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + dw * (i + 0.5);
      box(C, 'fdShellL', [x, -0.9, 0.136], [dw - 0.03, 0.46, 0.012], { bev: 0.004 }); box(C, 'steel', [x, -0.72, 0.153], [0.16, 0.016, 0.016], { bev: 0.004 });
      if (i === 1) vent(C, [x, -0.93, 0.142], 0.2, 0.2, 7); else sign(C, cfg.drawers[i === 0 ? 0 : 1], [x, -0.9, 0.143], { w: 0.2, h: 0.038 });
      led(C, [x + dw / 2 - 0.05, -0.68, 0.142], i === 1 ? 'Amber' : 'Green', i === 2 ? 'Blink' : '', 0.01);
    }
    box(C, 'fdShell', [0, -0.6, 0.11], [w + 0.04, 0.04, 0.22], { bev: 0.006 }); box(C, 'fdDash', [0, DESK + 0.002, 0.11], [w - 0.04, 0.004, 0.18], { bev: 0.001 });
    box(C, 'paintOrange', [0, -0.6, 0.223], [w + 0.04, 0.012, 0.006], { bev: 0.002 });
    for (const sx of [-1, 1]) box(C, 'trim', [sx * (w / 2 + 0.02), -0.6, 0.115], [0.012, 0.05, 0.23], { bev: 0.003 });
    // keyboard + underglow
    for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) box(TOP, 'plasticDark', [cfg.kb + (c - 5.5) * 0.026 - cx, -0.065 - r * 0.026, 0.004], [0.022, 0.022, 0.008], { bev: 0 });
    box(TOP, 'plasticDark', [cfg.kb - cx, -0.14, 0.004], [0.18, 0.016, 0.008], { bev: 0 }); box(TOP, 'emitStrip', [cfg.kb - cx, -0.04, 0.001], [0.33, 0.004, 0.003], { bev: 0 });
    cfg.left(TOP, cfg.lL - cx); cfg.right(TOP, cfg.lR - cx);
    // screen housing + screens + under-screen switch rows
    box(C, 'fdShell', [0, -0.195, 0.05], [w, 0.66, 0.1], { bev: 0.01 }); box(C, 'trim', [0, -0.2, 0.102], [w - 0.02, cfg.bez, 0.006], { bev: 0.002 });
    screws4(C, 0, -0.2, w - 0.05, 0.62, 0.1);
    cfg.screens.forEach((s, k) => {
      const [px, pz] = W.pt(s.lx, 0.1145);
      kit.screen({ id: s.id, pos: [px, s.y, pz], rot: [0, W.yaw, 0], size: s.size, res: [Math.round(s.size[0] * 900), Math.round(s.size[1] * 900)], draw: D[s.draw], range: 9, interval: 0.2 });
      const x = s.lx - cx, yy = s.y - s.size[1] / 2;
      sign(C, s.title, [x, yy - 0.035, 0.104], { w: 0.2, h: 0.034 });
      for (let i = 0; i < 5; i++) rocker(C, [x + (i - 2) * 0.05, yy - 0.105, 0.1], { up: (i + k) % 2, led: i === 4 - k ? 'Amber' : 'Green', pat: i === 2 && k === 1 ? 'Blink' : '' });
    });
    cfg.gauges.forEach((n, i) => {                                   // analogue instrument row on the eye-level fascia
      const x = (i - 2) * 0.21;
      gauge(C, [x, 0.06, 0.1], 0.042, i * 0.9 - 1.3); sign(C, n, [x, -0.004, 0.104], { w: 0.1, h: 0.03 });
      led(C, [x + 0.078, 0.078, 0.1], i % 2 ? 'Cyan' : 'Green', '', 0.008); led(C, [x + 0.078, 0.05, 0.1], 'Amber', i === 2 ? 'Blink' : '', 0.008);
    });
    // header rack (vents, LED arrays, cyan light bar) + cable tray up to the ceiling
    box(C, 'fdShell', [0, 0.32, 0.06], [w, 0.3, 0.12], { bev: 0.01 }); box(C, 'emitStrip', [0, 0.165, 0.123], [w - 0.06, 0.006, 0.004], { bev: 0 });
    for (let i = 0; i < 3; i++) { const x = -w / 2 + w / 3 * (i + 0.5); vent(C, [x, 0.34, 0.12], 0.2, 0.15, 7); for (let j = 0; j < 8; j++) led(C, [x - 0.07 + j * 0.02, 0.43, 0.12], j % 5 === 4 ? 'Amber' : 'Cyan', j === 6 ? 'Rand' : '', 0.008); }
    sign(C, cfg.name, [0, 0.215, 0.124], { w: 0.34, h: 0.04 });
    box(C, 'plasticDark', [0, 0.6, 0.04], [w, 0.09, 0.08], { bev: 0.006 }); tube(C, 'paintOrange', [[-w / 2, 0.6, 0.085], [0, 0.6, 0.09], [w / 2, 0.6, 0.085]], 0.012, { seg: 6 }); tube(C, 'paintCyan', [[-w / 2, 0.64, 0.085], [0, 0.64, 0.09], [w / 2, 0.64, 0.085]], 0.01, { seg: 6 });
    W.col(lx0, lx1, 0, 0.22, FLOOR, 0.5);
  };

  // avionics rack visuals in wall-contact frame C (panel convention), width w; 6 stacked modules + frame, floor to y 0.88
  const rackVis = (C, w, name) => {
    box(C, 'darkMetal', [0, -0.16, 0.16], [w, 2.08, 0.32], { bev: 0.01 }); for (const sx of [-1, 1]) box(C, 'trim', [sx * (w / 2 - 0.015), -0.16, 0.17], [0.03, 2.1, 0.34], { bev: 0.006 });
    box(C, 'trim', [0, 0.89, 0.17], [w, 0.03, 0.34], { bev: 0.006 }); box(C, 'hazard', [0, -1.17, 0.335], [w - 0.06, 0.06, 0.006], { bev: 0 });
    sign(C, name, [0, 0.82, 0.335], { w: 0.4, h: 0.04 });
    const mods = [[-0.9, 0.46, 'door'], [-0.52, 0.26, 'led'], [-0.24, 0.26, 'knob'], [0.04, 0.26, 'vent'], [0.32, 0.26, 'led'], [0.59, 0.24, 'tile']];
    mods.forEach(([y, h, kind], i) => {
      const ym = y + h / 2, s = Math.min(1, (w - 0.1) / 0.75);
      box(C, i % 2 ? 'plasticDark' : 'fdShellL', [0, ym, 0.328], [w - 0.07, h - 0.02, 0.012], { bev: 0.004 }); screws4(C, 0, ym, w - 0.09, h - 0.04, 0.334);
      for (const sx of [-1, 1]) box(C, 'steel', [sx * (w / 2 - 0.06), ym, 0.345], [0.016, Math.min(0.12, h * 0.5), 0.016], { bev: 0.004 });
      if (kind === 'led') for (let r = 0; r < 2; r++) for (let j = 0; j < 14; j++) led(C, [(-0.19 + j * 0.029) * s, ym + 0.04 - r * 0.07, 0.334], (j + r) % 6 === 5 ? 'Amber' : (j * 3 + r) % 7 === 2 ? 'Cyan' : 'Green', (j * 5 + r) % 9 === 4 ? 'Rand' : '', 0.011 * Math.max(0.7, s));
      if (kind === 'knob') { for (let j = 0; j < 4; j++) knob(C, [(-0.24 + j * 0.16) * s, ym, 0.334], 0.026 * Math.max(0.75, s), { a: j * 0.8 - 1, mark: j % 2 ? 'paintOrange' : 'paintWhite' }); }
      if (kind === 'vent') vent(C, [0, ym, 0.334], w - 0.2, h - 0.08, 6);
      if (kind === 'tile') { tile(C, [-0.12 * s, ym, 0.334], 0.2 * Math.max(0.6, s), 0.1, 'emitCyan'); for (let j = 0; j < 3; j++) toggle(C, [(0.15 + j * 0.06) * s, ym, 0.334], { tilt: j % 2 ? 0.3 : -0.2 }); }
      if (kind === 'door') { vent(C, [0, ym + 0.1, 0.334], w - 0.2, 0.14, 6); sign(C, 'AVIONICS BAY', [0, ym - 0.1, 0.34], { w: 0.3, h: 0.04, style: 'warn' }); }
    });
  };
  U.rack = rackVis;
  const rackAt = (W, lx0, lx1, name) => { rackVis(W.fr((lx0 + lx1) / 2, 0, 0), lx1 - lx0, name); W.col(lx0, lx1, 0, 0.34, FLOOR, 0.9); };

  // ── starboard: SYSTEMS console + rack ──
  consoleAt(SB, -1.04, 0.1, {
    name: 'SYSTEMS STATION', gauges: ['HULL', 'THERM', 'PWR', 'COOL', 'O2'], drawers: ['SPARES · A', 'LOGBOOKS'], kb: -0.47, lL: -0.86, lR: -0.1, bez: 0.27,
    screens: [{ id: 'fd.sys1', lx: -0.85, y: -0.2, size: [0.34, 0.21], draw: 'sys', title: 'SYSTEMS' }, { id: 'fd.sys2', lx: -0.47, y: -0.2, size: [0.34, 0.21], draw: 'power', title: 'POWER' }, { id: 'fd.sys3', lx: -0.09, y: -0.2, size: [0.34, 0.21], draw: 'comms', title: 'COMMS' }],
    left: (T, x) => { if (eur) return; for (let i = 0; i < 4; i++) { box(T, 'plasticDark', [x + i * 0.045 - 0.07, -0.1, 0.003], [0.012, 0.15, 0.006], { bev: 0.001 }); box(T, 'steel', [x + i * 0.045 - 0.07, -0.07 - i * 0.03, 0.012], [0.026, 0.018, 0.014], { bev: 0.003 }); box(T, i % 2 ? 'paintCyan' : 'paintOrange', [x + i * 0.045 - 0.07, -0.07 - i * 0.03, 0.02], [0.026, 0.006, 0.004], { bev: 0.001 }); } },
    right: (T, x) => { knob(T, [x - 0.07, -0.1, 0], 0.022, { a: 0.5 }); knob(T, [x - 0.02, -0.1, 0], 0.022, { a: -0.7, mark: 'paintOrange' }); for (let i = 0; i < 3; i++) { cyl(T, 'darkMetal', [x + 0.035 + i * 0.045 - 0.0, -0.1, 0.006], 0.016, 0.012, { axis: 'z', seg: 12 }); led(T, [x + 0.035 + i * 0.045, -0.1, 0.012], ['Green', 'Amber', 'Cyan'][i], '', 0.01); } toggle(T, [x - 0.05, -0.17, 0], { guard: true }); toggle(T, [x + 0.01, -0.17, 0]); },
  });
  rackAt(SB, 0.2, 1.05, 'AVIONICS · STBD');

  // ── port: NAV console + rack + jump stool ──
  consoleAt(PT, -0.1, 1.04, {
    name: 'NAV · FLIGHT PLAN', gauges: ['HDG', 'VEL', 'ALT', 'BURN', 'LOCK'], drawers: ['CHARTS', 'EVA TOOLS'], kb: 0.47, lL: 0.0, lR: 0.95, bez: 0.3,
    screens: [{ id: 'fd.nav2', lx: 0.06, y: -0.2, size: [0.3, 0.19], draw: 'traj', title: 'TRAJECTORY' }, { id: 'fd.nav1', lx: 0.47, y: -0.19, size: [0.42, 0.26], draw: 'nav', title: 'NAV CHART' }, { id: 'fd.nav3', lx: 0.88, y: -0.2, size: [0.3, 0.19], draw: 'descent', title: 'DESCENT PLAN' }],
    left: (T, x) => { for (let i = 0; i < 3; i++) knob(T, [x + 0.04 + i * 0.06, -0.1, 0], 0.021, { a: i * 0.9 - 0.9, mark: 'paintOrange' }); for (let i = 0; i < 4; i++) rocker(T, [x + 0.03 + i * 0.045, -0.17, 0], { up: i % 2, led: 'Cyan' }); },
    right: (T, x) => { box(T, 'hazard', [x - 0.05, -0.12, 0.003], [0.1, 0.1, 0.006], { bev: 0 }); toggle(T, [x - 0.05, -0.12, 0.006], { guard: true, tip: 'fdRed' }); sign(T, 'BURN ARM', [x - 0.05, -0.2, 0.002], { w: 0.1, h: 0.03, style: 'warn' }); for (let i = 0; i < 3; i++) { cyl(T, 'darkMetal', [x + 0.03 + i * 0.04, -0.12, 0.006], 0.015, 0.012, { axis: 'z', seg: 12 }); led(T, [x + 0.03 + i * 0.04, -0.12, 0.012], ['Green', 'Cyan', 'Amber'][i], '', 0.009); } },
  });
  rackAt(PT, -1.05, -0.2, 'COMPUTE · PORT');
  {   // jump stool in front of the nav console
    const [sx, sz] = PT.pt(0.47, 0.5), F = frame([sx, 0, sz], PT.yaw);
    cyl(F, 'darkMetal', [0, -1.185, 0], 0.2, 0.03, { seg: 20 }); cyl(F, 'steel', [0, -1.0, 0], 0.03, 0.34, { seg: 10 }); cyl(F, 'darkMetal', [0, -0.84, 0], 0.07, 0.06, { seg: 12 });
    cyl(F, 'fdSeat', [0, -0.81, 0], 0.17, 0.06, { seg: 20 }); torus(F, 'fabricOrange', [0, -0.78, 0], 0.168, 0.006, { axis: 'y', seg: 28, tube: 4 });
    torus(F, 'steel', [0, -1.0, 0], 0.17, 0.01, { axis: 'y', seg: 24, tube: 4 });
    kit.colCyl([sx, -0.7, sz], 0.2, 1.0);
  }
}
