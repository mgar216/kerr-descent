// Flight deck — pilot dash (classic cockpit framing: curved slanted dash, glare hood, 3 core screens, LED rows), kick plate, side consoles.
import * as THREE from 'three';
import { lerp, PI, DASH_SLOPE, dashBend } from './fd_util.js';

export default function build(kit, U) {
  const { box, cyl, torus, beam, sign, ribbon, dashPt, dashFrame, frame, at, led, tile, toggle, rocker, knob, vent, screws4, ID } = U;
  const eur = kit.eur, R = kit.rand(0xfd01);
  const xs = Array.from({ length: 26 }, (_, i) => -1.25 + i * 0.1);
  const gauge = (F, c, r, a) => {
    cyl(F, 'darkMetal', [c[0], c[1], 0.012], r * 1.18, 0.012, { axis: 'z', seg: 20 }); cyl(F, 'screenOff', [c[0], c[1], 0.0185], r * 0.95, 0.002, { axis: 'z', seg: 20 });
    torus(F, eur ? 'trim' : 'emitCyan', [c[0], c[1], 0.0195], r * 0.8, 0.0017, { seg: 24, tube: 4 });
    box(F, eur ? 'trim' : 'emitAmber', [c[0] - Math.sin(a) * r * 0.32, c[1] + Math.cos(a) * r * 0.32, 0.0205], [0.003, r * 0.66, 0.002], { rot: [0, 0, a], bev: 0 });
  };

  // ── dash surface (identical mapping to core.js buildCockpit) ──
  {
    const g = new THREE.PlaneGeometry(2.5, 0.72, 24, 6), pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const p = dashPt(pa.getX(i), pa.getY(i) / 0.72 + 0.5); pa.setXYZ(i, p.x, p.y, p.z); }
    g.computeVertexNormals(); kit.add('fdDash', g); g.dispose();
  }
  // cowl ledge closing the gap between the dash top edge and the canopy sill; toe kick plate down to the floor with a cyan floor glow + orange hairline
  const zf = (x) => -1.0 + 0.09 * Math.max(0, (Math.abs(x) - 0.4) / 0.85);
  ribbon('trim', xs.map((x) => [x, -0.44, -0.98 + dashBend(x)]), xs.map((x) => [x, -0.44, zf(x)]), [0, 1, 0]);
  ribbon('trim', xs.map((x) => [x, -1.02, -0.42 + dashBend(x)]), xs.map((x) => [x, -1.2, -0.42 + dashBend(x)]), [0, 0, 1]);
  for (let i = 0; i < 25; i++) {
    const a = [xs[i], -1.185, -0.414 + dashBend(xs[i])], b = [xs[i + 1], -1.185, -0.414 + dashBend(xs[i + 1])];
    beam(ID, 'emitStrip', a, b, 0.012, 0.012, { bev: 0 });
    const p = dashPt(xs[i], 0.035), q = dashPt(xs[i + 1], 0.035);
    beam(ID, 'paintOrange', [p.x, p.y + 0.0016, p.z + 0.0016], [q.x, q.y + 0.0016, q.z + 0.0016], 0.008, 0.004, { bev: 0 });
  }
  // colliders: stepped wedge (the dash toe follows the bend)
  kit.colBox([0, -0.82, -0.69], [1.2, 0.76, 0.62]);
  for (const sx of [-1, 1]) { kit.colBox([sx * 0.8, -0.82, -0.655], [0.4, 0.76, 0.69]); kit.colBox([sx * 1.125, -0.82, -0.62], [0.25, 0.76, 0.76]); }

  // instrument glow (the classic cockpit's PointLight 0x5fdcff at (0,−0.55,−0.55)) as a weak pooled site: washes the dash, lap and seat front
  kit.light('fd.inst', [0, -0.5, -0.5], { color: 0x6fdcff, k: 0.09 });
  // ── three core-driven screens (ids 0,1,2), placed exactly like the classic cockpit ──
  const yv = 0.42;
  for (const [x, id] of [[-0.5, 0], [0, 1], [0.5, 2]]) {
    kit.screen({ id, pos: [x, lerp(-1.02, -0.44, yv) + 0.008, lerp(-0.42, -0.98, yv) + dashBend(x) + 0.012], rot: [-(PI / 2 - DASH_SLOPE), -x * 0.28, 0], size: [0.36, 0.225], res: [384, 240], core: true });
    const P = dashFrame(x, yv);
    box(P, 'emitStrip', [0, -0.1315, 0.003], [0.3, 0.004, 0.004], { bev: 0 });
    for (const sx of [-1, 1]) box(P, 'darkMetal', [sx * 0.2, -0.0, 0.002], [0.012, 0.25, 0.004], { bev: 0.001 });
  }
  // status LED rows (the classic 2 × 20 array) — static, colour-coded
  for (let i = 0; i < 40; i++) {
    const c = i % 20, r = (i / 20) | 0, x = -0.62 + c * 0.065, P = dashFrame(x, 0.12 + r * 0.07);
    let col = 'Green', pat = '';
    if (c === 19 && !r) { col = 'Red'; pat = 'Blink'; } else if (c % 7 === 3) { col = 'Amber'; pat = r ? 'Blink' : ''; } else if ((c + r) % 4 === 1) col = 'Cyan'; else if (c % 9 === 5) pat = 'Rand';
    led(P, [0, 0, 0.003], col, pat, 0.0125);
  }
  // gap columns between the screens
  for (const gx of [-0.25, 0.25]) { const P = dashFrame(gx, yv); for (let i = 0; i < 5; i++) led(P, [0, -0.09 + i * 0.045, 0.002], ['Cyan', 'Green', 'Green', 'Amber', 'Cyan'][i], i === 3 ? 'Blink' : '', 0.01); }

  // ── annunciator strip + switch row above the screens (under the hood) ──
  {
    const P = dashFrame(0, 0.745);
    box(P, 'plasticDark', [0, 0, 0.0025], [1.42, 0.17, 0.005], { bev: 0.002 }); screws4(P, 0, 0, 1.4, 0.15, 0.005);
    const names = ['FUEL', 'O2', 'PWR', 'NAV', 'COMM', 'THRM', 'HULL', 'RCS', 'DRIVE', 'LOCK', 'DOCK', 'CAUT', 'GRAV', 'LYRA'], cols = ['emitGreen', 'emitGreen', 'emitCyan', 'emitCyan', 'emitGreen', 'emitAmber', 'emitGreen', 'emitCyan', 'emitAmber', 'emitGreen', 'emitCyan', 'emitAmber', 'emitGreen', 'emitCyan'];
    names.forEach((n, i) => {
      const lx = -0.585 + i * 0.09;
      sign(P, n, [lx, 0.052, 0.006], { w: 0.075, h: 0.028 });
      box(P, eur ? 'screenOff' : cols[i], [lx, 0.03, 0.0055], [0.07, 0.006, 0.003], { bev: 0 });
    });
    for (let i = 0; i < 12; i++) rocker(P, [-0.55 + i * 0.1, -0.035, 0.005], { up: (i * 7) % 3 !== 0, led: i % 4 === 3 ? 'Amber' : 'Green', pat: i === 5 ? 'Blink' : '' });
  }
  // side clusters (left: drive/RCS, right: nav/comms)
  const cluster = (cx, title, fill) => { const P = dashFrame(cx, 0.52); box(P, 'plasticDark', [0, 0, 0.003], [0.4, 0.5, 0.006], { bev: 0.003 }); screws4(P, 0, 0, 0.37, 0.47, 0.006); sign(P, title, [0, 0.215, 0.007], { w: 0.22, h: 0.034 }); fill(P); };
  cluster(-0.98, 'DRIVE · RCS', (P) => {
    [-0.135, -0.045, 0.045, 0.135].forEach((lx, i) => { toggle(P, [lx, 0.12, 0.006], { guard: true }); led(P, [lx, 0.175, 0.006], ['Green', 'Green', 'Amber', 'Cyan'][i], i === 2 ? 'Blink' : '', 0.009); });
    knob(P, [-0.1, 0.005, 0.006], 0.022, { a: 0.6 }); knob(P, [0.1, 0.005, 0.006], 0.022, { a: -0.9 }); tile(P, [0, 0.005, 0.006], 0.07, 0.034, 'emitAmber');
    [-0.15, -0.09, -0.03, 0.03, 0.09, 0.15].forEach((lx, i) => rocker(P, [lx, -0.1, 0.006], { up: i % 2 === 0, led: i % 3 === 0 ? 'Green' : 'Amber' }));
    for (let i = 0; i < 12; i++) led(P, [-0.15 + i * 0.0273, -0.2, 0.006], i < 7 ? 'Green' : i < 10 ? 'Amber' : 'Red', '', 0.012);
  });
  cluster(0.98, 'NAV · COMMS', (P) => {
    gauge(P, [-0.1, 0.12, 0.006], 0.045, 0.7); gauge(P, [0.1, 0.12, 0.006], 0.045, -0.5);
    [-0.12, 0, 0.12].forEach((lx, i) => knob(P, [lx, -0.0, 0.006], 0.02, { a: i - 1, mark: 'paintOrange' }));
    [-0.15, -0.075, 0, 0.075, 0.15].forEach((lx, i) => toggle(P, [lx, -0.1, 0.006], { tilt: i % 2 ? 0.35 : -0.25, tip: i === 2 ? 'paintOrange' : 'plastic' }));
    tile(P, [-0.1, -0.19, 0.006], 0.07, 0.03, 'emitCyan'); tile(P, [0.1, -0.19, 0.006], 0.07, 0.03, 'emitGreen');
  });
  for (const sx of [-1, 1]) vent(dashFrame(sx * 0.62, 0.78), [0, 0, 0.003], 0.1, 0.05, 5);

  // ── glare hood + cyan light beam + brackets (identical to the classic cockpit) ──
  kit.box('trim', [0, -0.405, -0.86], [1.5, 0.035, 0.26], { rot: [0.12, 0, 0], bev: 0.006 });
  kit.box('emitCyan', [0, -0.425, -0.75], [1.48, 0.006, 0.006], { bev: 0 });
  for (const sx of [-1, 1]) { beam(ID, 'trim', [sx * 0.72, -0.43, -0.76], [sx * 0.74, -0.7, -0.9], 0.025, 0.012, { bev: 0.003 }); }

  // ── side consoles: tilted desks with a floor cabinet (classic position x ±0.98, y −0.82, z −0.25, 0.42×0.16×0.9, roll ±0.25) ──
  for (const sx of [-1, 1]) {
    const SC = frame([sx * 0.98, -0.82, -0.25], 0, 0, sx * 0.25), TOP = at(SC, [0, 0.08, 0], { rot: [-PI / 2, 0, 0] });
    box(SC, 'fdDash', [0, 0, 0], [0.42, 0.16, 0.9], { bev: 0.008 });
    box(SC, 'trim', [-sx * 0.215, 0, 0], [0.012, 0.17, 0.92], { bev: 0.003 });
    kit.box(sx < 0 ? 'emitAmber' : 'emitCyan', [sx * 0.8, -0.73, -0.265], [0.008, 0.008, 0.83], { bev: 0 });
    kit.box('fdShell', [sx * 1.115, -1.06, -0.25], [0.27, 0.28, 0.9], { bev: 0.006 }); kit.box('trim', [sx * 1.225, -0.9, -0.25], [0.05, 0.1, 0.92], { bev: 0.004 });
    kit.box('plasticDark', [sx * 0.97, -1.07, -0.25], [0.03, 0.24, 0.84], { bev: 0.004 }); kit.box('emitStripO', [sx * 0.953, -1.19, -0.25], [0.006, 0.012, 0.8], { bev: 0 });
    kit.colBox([sx * 1.115, -0.9, -0.25], [0.27, 0.6, 0.9]);
    const FACE = frame([sx * 0.953, -1.06, -0.25], -sx * PI / 2);
    for (let i = 0; i < 3; i++) if (eur || sx > 0 || i !== 1) vent(FACE, [-0.24 + i * 0.24, 0.0, 0], 0.18, 0.1, 5);
    for (let i = 0; i < 6; i++) led(FACE, [-0.3 + i * 0.12, 0.1, 0], i % 2 ? 'Green' : 'Cyan', i === 4 ? 'Blink' : '', 0.008);
    sign(FACE, sx < 0 ? 'THROTTLE · FLIGHT' : 'NAV · COMMS', [0, -0.1, 0], { w: 0.34, h: 0.04 });
    // desk top
    if (sx < 0) {
      box(TOP, 'darkMetal', [-0.02, 0.05, 0.001], [0.07, 0.62, 0.004], { bev: 0.002 });
      [-0.12, 0.08].forEach((ly, i) => { box(TOP, 'steel', [-0.02, ly, 0.006], [0.05, 0.03, 0.012], { bev: 0.003 }); box(TOP, i ? 'paintCyan' : 'paintOrange', [-0.02, ly, 0.014], [0.05, 0.012, 0.006], { bev: 0.002 }); });
      for (let i = 0; i < 4; i++) toggle(TOP, [0.12, 0.3 - i * 0.07, 0.0], { guard: i < 2 });
      for (let i = 0; i < 6; i++) rocker(TOP, [-0.15, 0.32 - i * 0.07, 0.0], { up: i % 2, led: 'Amber' });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) box(TOP, 'plastic', [0.05 + c * 0.04 - 0.04, -0.28 - r * 0.04, 0.005], [0.032, 0.032, 0.01], { bev: 0.003 });
      tile(TOP, [-0.12, -0.36, 0.0], 0.1, 0.05, 'emitAmber');
    } else {
      cyl(TOP, 'steel', [0.0, 0.0, 0.004], 0.04, 0.008, { axis: 'z', seg: 18 }); kit.add('darkMetal', new THREE.SphereGeometry(0.026, 12, 8), { matrix: at(TOP, [0, 0, 0.012]) });
      for (let i = 0; i < 3; i++) knob(TOP, [-0.12 + i * 0.12, 0.3, 0.0], 0.02, { a: i * 0.7 - 0.7, mark: 'paintOrange' });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) box(TOP, 'plasticDark', [-0.14 + c * 0.07, -0.18 - r * 0.07, 0.004], [0.055, 0.05, 0.008], { bev: 0.003 }), led(TOP, [-0.14 + c * 0.07, -0.18 - r * 0.07 + 0.017, 0.008], (r + c) % 3 ? 'Cyan' : 'Green', '', 0.006);
      tile(TOP, [0.0, 0.14, 0.0], 0.2, 0.06, 'emitCyan');
      for (let i = 0; i < 4; i++) toggle(TOP, [-0.15 + i * 0.1, 0.4, 0.0], { tilt: 0.3 });
    }
  }
}
