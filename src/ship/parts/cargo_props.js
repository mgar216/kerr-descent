// CARGO BAY — survey probe rack (6 torpedo probes in padded cradles), rover/lander cradle with hold-downs, overhead monorail crane.
import * as S from './screens.js';
import { frame } from './bay_util.js';

export default function props(kit, C) {
  probeRack(kit, C);
  cradle(kit, C);
  crane(kit, C);
}

// ───────────────────────── probe rack (starboard wall) ─────────────────────────
function probeRack(kit, C) {
  const FLOOR = kit.L.FLOOR, eur = kit.eur, rk = C.rack, W = frame(kit, [0, 0, 0], 0);
  const F = frame(kit, [3.5, FLOOR, rk.cz], -Math.PI / 2);        // local +z = toward the aisle (−x), +x = aft (world +z), y = 0 at the deck
  const LEN = 4.4, D = 0.56, yT = [0.4, 0.86], slots = [-1.45, 0, 1.45];
  const has = (t, s) => !eur || (t === 0 && s === 1) || (t === 1 && s !== 1);
  F.box('trim', [0, 0.05, D / 2 - 0.01], [LEN, 0.1, D + 0.04], { bev: 0.008 });
  F.box('wallDark', [0, 0.65, 0.012], [LEN, 1.1, 0.02], { bev: 0.004 });
  for (const y of [0.55, 1.0]) F.box('abTrack', [0, y, 0.026], [LEN - 0.1, 0.04, 0.012], { bev: 0 });
  for (const x of [-2.175, -0.725, 0.725, 2.175]) for (const z of [0.04, D - 0.04]) { F.box('trim', [x, 0.62, z], [0.06, 1.14, 0.06], { bev: 0.006 }); F.box('paintOrange', [x, 1.2, z], [0.075, 0.03, 0.075], { bev: 0.004 }); }
  for (const z of [0.04, D - 0.04]) F.box('trim', [0, 1.18, z], [LEN, 0.05, 0.05], { bev: 0.006 });
  F.box('paintOrange', [0, 1.17, D - 0.012], [LEN - 0.4, 0.012, 0.012], { bev: 0 });
  F.box('emitStrip', [0, 1.145, D - 0.02], [LEN - 0.5, 0.012, 0.012], { bev: 0 });
  // shelves + pull-out loading rails (E-track rollers) + cross members
  for (const y of yT) {
    for (const z of [0.07, D - 0.07]) F.box('steel', [0, y - 0.14, z], [LEN - 0.08, 0.045, 0.05], { bev: 0.006 });
    F.box('abTrack', [0, y - 0.155, D + 0.035], [LEN - 0.1, 0.03, 0.045], { bev: 0.004 });
    for (const x of [-2.175, -0.725, 0.725, 2.175]) F.box('trim', [x, y - 0.14, D / 2], [0.05, 0.04, D - 0.1], { bev: 0.004 });
  }
  F.sign('SURVEY PROBES · P-1', [-1.1, 1.08, D + 0.001], { w: 0.82, h: 0.1, style: 'door' });
  F.sign('LOAD RAIL 80 KG', [1.5, 1.08, D + 0.001], { w: 0.5, h: 0.08, style: 'warn' });
  // end plate + inventory screen (faces the cargo door)
  F.box('white', [-2.215, 0.62, D / 2], [0.03, 0.9, D + 0.02], { bev: 0.006 });
  const plate = F.P(-2.232, 0.7, D / 2);
  kit.screen({ id: 'cargo.rack', pos: plate, rot: [0, Math.PI, 0], size: [0.46, 0.3], res: [320, 208], range: 7, draw: (g, w, h, t) => drawRack(g, w, h, t, has) });
  let n = 0;
  yT.forEach((y, t) => slots.forEach((lx, s) => {
    for (const sx of [-1, 1]) {   // saddles
      const x = lx + sx * 0.4;
      F.box('plasticDark', [x, y - 0.115, 0.28], [0.13, 0.04, 0.34], { bev: 0.006 });
      for (const sz of [-1, 1]) F.box('fabricOrange', [x, y - 0.075, 0.28 + sz * 0.105], [0.12, 0.09, 0.05], { bev: 0.008, rx: -sz * 0.5 });
      if (has(t, s) && !eur) { F.torus('steel', [x, y, 0.28], 0.127, 0.007, { axis: 'x', tube: 4, seg: 18 }); F.box('trim', [x, y + 0.135, 0.28], [0.045, 0.03, 0.06], { bev: 0.004 }); F.box('emitGreen', [x, y + 0.153, 0.28], [0.012, 0.004, 0.012], { bev: 0 }); }
      else if (has(t, s)) { F.torus('steel', [x, y, 0.28], 0.127, 0.007, { axis: 'x', tube: 4, seg: 18, arc: Math.PI * 1.55 }); }
      else { F.box('fabricOrange', [x + 0.03, y - 0.28, 0.28 + sx * 0.12], [0.04, 0.34, 0.004], { bev: 0, rz: 0.12 * sx }); F.box('steel', [x + 0.03, y - 0.46, 0.28 + sx * 0.12], [0.06, 0.03, 0.02], { bev: 0.003 }); }
    }
    if (!has(t, s)) return;
    n++; probe(F.sub([lx, y, 0.28], -Math.PI / 2), n, eur);
  }));
  if (eur) {   // one probe fallen out of its cradle onto the deck, nose toward the door
    const fp = frame(kit, [2.8, FLOOR + 0.115, 28.55], -0.05);
    probe(fp, 2, true); kit.colBox([2.8, FLOOR + 0.2, 28.55], [0.28, 0.3, 1.3], { yaw: -0.05 });
  }
  F.col([0, 0.65, 0.29], [LEN, 1.3, 0.58]);
  kit.interact({ id: 'cargo.probes', label: 'Survey probe rack', pos: F.P(0, 0.7, 0.4), radius: 2.2, hit: { c: F.P(0, 0.65, 0.28), s: [0.6, 1.3, LEN] } });
}
// one torpedo probe. Local +z = nose, 0.105 m radius, 1.3 m long, centred at the origin.
function probe(P, n, dead) {
  const prof = [[0, -0.66], [0.055, -0.66], [0.07, -0.63], [0.06, -0.58], [0.105, -0.52], [0.105, 0.3], [0.098, 0.38], [0.082, 0.46], [0.058, 0.54], [0.03, 0.6], [0, 0.64]];
  P.lathe('abProbe', prof, { axis: 'z', seg: 20 });
  P.torus(dead ? 'trim' : 'emitCyan', [0, 0, 0.0], 0.108, 0.007, { axis: 'z', tube: 4, seg: 24 });
  P.torus(dead ? 'trim' : 'emitCyan', [0, 0, -0.07], 0.108, 0.004, { axis: 'z', tube: 4, seg: 24 });
  P.cyl('paintOrange', [0, 0, 0.3], 0.108, 0.05, { axis: 'z', seg: 20 });
  P.cyl('paintOrange', [0, 0, -0.44], 0.108, 0.04, { axis: 'z', seg: 20 });
  P.cyl('darkMetal', [0, 0, -0.67], 0.07, 0.04, { axis: 'z', seg: 12, rt: 0.05, rb: 0.07 });
  P.sph('rubber', [0, 0, 0.62], 0.022, { seg: 8 });
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; P.box('paintOrange', [Math.cos(a) * 0.185, Math.sin(a) * 0.185, -0.5], [0.16, 0.012, 0.24], { bev: 0.003, rz: a }); }
  P.st('sp' + n, [0.1085, 0, -0.1], [0.26, 0.082], { ry: Math.PI / 2 });
  P.box('paintOrange', [0, -0.16, 0.3], [0.05, 0.1, 0.004], { bev: 0.001 });
  P.torus('steel', [0, 0, 0.3], 0.112, 0.004, { axis: 'z', tube: 3, seg: 18 });
}
function drawRack(g, w, h, t, has) {
  const C = S.C, r = S.base(g, w, h, t, { title: 'PROBE RACK P-1', sub: 'LINK' });
  let n = 0;
  for (let i = 0; i < 6; i++) {
    const tier = i < 3 ? 0 : 1, slot = i % 3, ok = has(tier, slot), y = r.y + 16 + i * 25;
    if (ok) n++;
    S.mono(g, 'SP-0' + (i + 1), 16, y + 12, 15, ok ? C.ink : C.cyd);
    if (ok) { const b = 0.82 + 0.15 * Math.sin(i * 1.7); g.fillStyle = C.cyf; g.fillRect(84, y, 110, 14); g.fillStyle = C.green; g.fillRect(84, y, 110 * b, 14); S.mono(g, Math.round(b * 100) + '%', 202, y + 12, 13, C.cy); S.mono(g, Math.sin(t * 3 + i) > -0.3 ? 'READY' : 'LINK', w - 14, y + 12, 13, C.green, 'right'); }
    else S.mono(g, 'EMPTY', 84, y + 12, 14, C.amber);
  }
  S.mono(g, n + ' / 6 LOADED', 16, h - 12, 15, C.cy, 'left', 700);
}

// ───────────────────────── rover cradle (ORPHEUS) / LANTERN lander cradle (EURYDICE) — port side ─────────────────────────
function cradle(kit, C) {
  const FLOOR = kit.L.FLOOR, eur = kit.eur, cl = C.cradle, W = frame(kit, [0, 0, 0], 0), R = kit.rand(0x7ad1);
  const { cx, cz, z0, z1 } = cl, sk = eur ? 0.78 : 0.6, len = z1 - z0 - 0.2;
  for (const sx of [-1, 1]) {
    W.box('steel', [cx + sx * sk, FLOOR + 0.075, cz], [0.18, 0.15, len], { bev: 0.01 });
    W.box('trim', [cx + sx * sk, FLOOR + 0.155, cz], [0.1, 0.012, len - 0.15], { bev: 0 });
    for (let i = 0; i < 6; i++) W.cyl('steel', [cx + sx * sk, FLOOR + 0.158, z0 + 0.3 + i * (len - 0.6) / 5], 0.016, 0.01, { seg: 6 });
  }
  for (const zz of [z0 + 0.22, cz, z1 - 0.22]) { W.box('trim', [cx, FLOOR + 0.05, zz], [2 * sk + 0.3, 0.1, 0.15], { bev: 0.008 }); W.box('abYellow', [cx, FLOOR + 0.102, zz], [2 * sk + 0.3, 0.004, 0.04], { bev: 0 }); }
  if (!eur) {
    for (const sx of [-1, 1]) for (const zw of [cz - 1.2, cz + 1.2]) {   // wheel chocks (orange wedges front/back of each wheel station)
      W.ext('paintOrange', [[0, 0], [0.26, 0], [0.26, 0.17]], 0.2, { pos: [cx + sx * sk, FLOOR, zw - 0.46], ry: -Math.PI / 2 });
      W.ext('paintOrange', [[0, 0], [0.26, 0], [0.26, 0.17]], 0.2, { pos: [cx + sx * sk, FLOOR, zw + 0.46], ry: Math.PI / 2 });
      W.box('rubber', [cx + sx * sk, FLOOR + 0.162, zw], [0.2, 0.008, 0.5], { bev: 0.002 });
    }
  }
  // hold-down towers (colliders) — corner clamps with hydraulic ram, hanging webbing (cut + frayed on EURYDICE)
  const tall = eur ? 1.5 : 1.1, ex = eur ? 0.1 : 0.07;
  const corners = [[cl.x0 + 0.14, z0 + 0.18, 1, 1], [cl.x1 - 0.14, z0 + 0.18, -1, 1], [cl.x0 + 0.14, z1 - 0.18, 1, -1], [cl.x1 - 0.14, z1 - 0.18, -1, -1]];
  corners.forEach(([x, z, sx, sz], i) => {
    W.box('trim', [x, FLOOR + 0.02, z], [0.3, 0.04, 0.3], { bev: 0.006 });
    for (const [dx, dz] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) W.cyl('steel', [x + dx, FLOOR + 0.045, z + dz], 0.013, 0.012, { seg: 6 });
    W.box('steel', [x, FLOOR + tall / 2 + 0.04, z], [0.14 + ex * 0.5, tall, 0.14 + ex * 0.5], { bev: 0.01 });
    W.box('paintOrange', [x, FLOOR + tall + 0.05, z], [0.19, 0.05, 0.19], { bev: 0.006 });
    W.box('plasticDark', [x + sx * 0.075, FLOOR + 0.6, z], [0.012, 0.28, 0.09], { bev: 0.003 });
    W.box(kit.led(eur ? 'Red' : 'Amber', eur ? 'Rand' : 'Blink'), [x + sx * 0.083, FLOOR + 0.7, z], [0.008, 0.016, 0.016], { bev: 0 });
    kit.colCyl([x, FLOOR + tall / 2, z], 0.11, tall);
    const broken = eur && (i === 1 || i === 2);
    const armTop = FLOOR + tall - 0.06;
    if (!broken) {
      const drop = eur ? -0.7 : -0.12, L2 = 0.5;
      W.beam('paintOrange', [x, armTop, z], [x + sx * L2 * Math.cos(drop), armTop + L2 * Math.sin(drop), z + sz * 0.02], 0.08, 0.06, { bev: 0.008 });
      W.beam('steel', [x, FLOOR + tall * 0.5, z + sz * 0.07], [x + sx * 0.3 * Math.cos(drop), armTop - 0.04 + 0.28 * Math.sin(drop), z + sz * 0.05], 0.035, 0.035, { bev: 0.006 });
      W.box('paintOrange', [x + sx * (L2 * Math.cos(drop) + 0.02), armTop + L2 * Math.sin(drop) - 0.04, z], [0.06, 0.12, 0.11], { bev: 0.008 });
    } else {   // arm sheared off, lying near the foot
      W.box('paintOrange', [x + sx * 0.55, FLOOR + 0.05, z + sz * 0.3], [0.5, 0.06, 0.08], { bev: 0.006, ry: 0.5 * sx });
      W.cyl('steel', [x, armTop, z], 0.03, 0.14, { axis: 'z', seg: 8 });
    }
    // webbing from the clamp
    const hang = eur ? 0.32 : 0.6, sag = eur ? R() * 0.2 : 0;
    W.box('fabricOrange', [x + sx * 0.22, armTop - 0.18 - hang / 2, z + sz * 0.02], [0.045, hang, 0.005], { bev: 0, rz: 0.06 + sag, ry: 0.2 });
    if (!eur) { W.box('steel', [x + sx * 0.22, armTop - 0.2 - hang, z + sz * 0.02], [0.07, 0.09, 0.03], { bev: 0.004 }); W.torus('steel', [x + sx * 0.22, armTop - 0.28 - hang, z + sz * 0.02], 0.035, 0.007, { axis: 'z', tube: 4, seg: 12 }); }
  });
  // tie-down eyes along the skids
  for (const sx of [-1, 1]) for (const zz of [z0 + 0.5, cz, z1 - 0.5]) { W.box('trim', [cx + sx * (sk + 0.25), FLOOR + 0.006, zz], [0.14, 0.012, 0.14], { bev: 0 }); W.torus('steel', [cx + sx * (sk + 0.25), FLOOR + 0.03, zz], 0.04, 0.008, { axis: 'z', tube: 4, seg: 10, rx: 0.4 }); }
  if (eur) {   // cut umbilicals, snaking across the scorched deck
    for (const [x, z, k] of [[cl.x1 - 0.14, z0 + 0.18, 1], [cl.x0 + 0.14, z1 - 0.18, -1]]) {
      W.tube('rubber', [[x, FLOOR + 1.3, z], [x - 0.1 * k, FLOOR + 0.8, z + 0.2 * k], [x - 0.3 * k, FLOOR + 0.1, z + 0.6 * k], [x - 0.9 * k, FLOOR + 0.025, z + 0.7 * k], [x - 1.4 * k, FLOOR + 0.025, z + 0.5 * k]], 0.024, { seg: 20, rseg: 6 });
      W.sph('abCopper', [x - 1.4 * k, FLOOR + 0.03, z + 0.5 * k], 0.03, { seg: 8 });
    }
    W.tube('abBlue', [[cl.x0 + 0.3, FLOOR + 0.02, z0 + 0.4], [cl.x0 + 0.9, FLOOR + 0.02, z0 + 1.0], [cl.x0 + 1.3, FLOOR + 0.02, z0 + 0.6], [cl.x0 + 1.9, FLOOR + 0.02, z0 + 0.9]], 0.02, { seg: 18, rseg: 6 });
  }
}

// ───────────────────────── overhead monorail crane + hoist over the cradle ─────────────────────────
function crane(kit, C) {
  const FLOOR = kit.L.FLOOR, CEIL = kit.L.CEIL, eur = kit.eur, cl = C.cradle, W = frame(kit, [0, 0, 0], 0);
  const mx = cl.cx, z0 = 24.35, z1 = 30.85, tz = cl.cz;
  W.box('abYellow', [mx, 1.04, (z0 + z1) / 2], [0.04, 0.17, z1 - z0], { bev: 0.004 });
  for (const y of [0.945, 1.145]) W.box('abYellow', [mx, y, (z0 + z1) / 2], [0.15, 0.03, z1 - z0], { bev: 0.006 });
  for (const z of [24.7, 26.3, 27.9, 29.5, 30.7]) { W.box('trim', [mx, 1.255, z], [0.06, 0.2, 0.1], { bev: 0.006 }); W.box('trim', [mx, 1.16, z], [0.2, 0.025, 0.12], { bev: 0.004 }); }
  for (const z of [z0, z1]) W.box('rubber', [mx, 1.04, z + (z === z0 ? -0.0 : 0.0)], [0.2, 0.22, 0.04], { bev: 0.008 });
  // trolley + hoist
  for (const sx of [-1, 1]) { W.box('trim', [mx + sx * 0.1, 1.0, tz], [0.02, 0.2, 0.36], { bev: 0.004 }); for (const dz of [-0.12, 0.12]) W.cyl('steel', [mx + sx * 0.09, 0.945 + 0.0, tz + dz], 0.035, 0.018, { axis: 'x', seg: 10 }); }
  W.box('trim', [mx, 0.88, tz], [0.22, 0.035, 0.24], { bev: 0.004 });
  W.box('abYellow', [mx, 0.7, tz], [0.3, 0.3, 0.5], { bev: 0.025 });
  W.cyl('darkMetal', [mx, 0.7, tz + 0.34], 0.1, 0.18, { axis: 'z', seg: 14 });
  W.cyl('steel', [mx, 0.7, tz - 0.3], 0.07, 0.12, { axis: 'z', seg: 12 });
  W.box('plasticDark', [mx + 0.16, 0.74, tz], [0.02, 0.14, 0.2], { bev: 0.003 });
  W.box(kit.led(eur ? 'Red' : 'Green', ''), [mx + 0.172, 0.78, tz], [0.006, 0.02, 0.02], { bev: 0 });
  W.cyl('darkMetal', [mx, 0.36, tz], 0.015, 0.42, { seg: 6 });
  W.cyl('darkMetal', [mx + 0.03, 0.36, tz], 0.012, 0.42, { seg: 6 });
  W.box('abYellow', [mx, 0.14, tz], [0.1, 0.13, 0.1], { bev: 0.012 });
  W.torus('steel', [mx, 0.03, tz], 0.055, 0.013, { axis: 'x', tube: 5, seg: 16, arc: Math.PI * 1.55, ry: 0 });
  W.box('trim', [mx, -0.02, tz + 0.03], [0.02, 0.02, 0.02], { bev: 0 });
  kit.colCyl([mx, 0.3, tz], 0.16, 1.1);
  // pendant control + sling (cut + frayed on EURYDICE)
  W.tube('rubber', [[mx + 0.15, 0.62, tz + 0.1], [mx + 0.28, 0.4, tz + 0.22], [mx + 0.24, 0.16, tz + 0.3]], 0.011, { seg: 12, rseg: 5 });
  W.box('plasticDark', [mx + 0.24, 0.07, tz + 0.3], [0.06, 0.15, 0.04], { bev: 0.006 });
  W.box('emitGreen', [mx + 0.24, 0.1, tz + 0.322], [0.02, 0.02, 0.004], { bev: 0 }); W.box('emitRed', [mx + 0.24, 0.04, tz + 0.322], [0.02, 0.02, 0.004], { bev: 0 });
  for (const sx of [-1, 1]) {
    const len = eur ? (sx < 0 ? 0.55 : 0.28) : 0.62;
    W.box('fabricOrange', [mx + sx * 0.09, 0.0 - len / 2 + 0.07, tz - 0.02], [0.05, len, 0.006], { bev: 0, rz: sx * 0.18 });
    if (!eur) W.torus('steel', [mx + sx * 0.19, -0.58, tz - 0.02], 0.03, 0.007, { axis: 'z', tube: 4, seg: 10 });
  }
}
