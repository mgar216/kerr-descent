// Open-riser stair from the spine corridor (z 12.3, y −1.2) up to the dome deck (z 7.9, y +1.4): treads, stringers, handrails, overhead hatch frame,
// safety rail around the opening on the deck (gate gap at the top), walkable ramp + colliders.
import { Acc, flatSeg } from './dome_util.js';

export default function build(kit) {
  const L = kit.L, S = L.STAIR, N = 14, zf = S.zFoot, zt = S.zTop, run = (zf - zt) / N, rise = (S.yTop - S.yFoot) / N, slope = rise / run;
  const ramp = (z) => S.yFoot + (zf - z) * slope;                       // walking surface (identical to the registered ramp)
  const xL = S.x0, xR = S.x1, xc = (xL + xR) / 2, DK = S.yTop, HZ0 = S.holeZ0, HZ1 = S.holeZ1, yU = L.CEIL, GZ = 8.62;   // GZ: top end of the stair rails (gate gap beyond)
  kit.floor(xL, zt, xR, zf, S.yTop, S.yFoot, 'z', { step: 'metal' });
  const post = (mat, x, y0, z, h, r) => kit.cyl(mat, [x, y0 + h / 2, z], r, h, { seg: 8 });
  const bar = (mat, a, b, r) => kit.tube(mat, [a, b], r, { seg: 2, rseg: 8 });

  // ───────── treads (open risers): plate, brushed nosing, edge light, kick plate ─────────
  for (let i = 1; i <= N; i++) {
    const zc = zf - (i - 0.5) * run, yt = S.yFoot + (i - 0.5) * rise, za = zc + run / 2 + 0.02;      // za = aft (nosing) edge
    kit.box('floor', [xc, yt - 0.02, zc + 0.01], [0.84, 0.04, run + 0.02], { bev: 0.004 });
    kit.box('metal', [xc, yt - 0.006, za - 0.023], [0.86, 0.02, 0.05], { bev: 0.004 });
    kit.box('emitStrip', [xc, yt + 0.002, za - 0.065], [0.7, 0.004, 0.012], { bev: 0 });
    kit.box('trim', [xc, yt - 0.085, zc - run / 2 + 0.012], [0.82, 0.09, 0.012], { bev: 0.002 });
  }
  // ───────── stringers (side plates under the treads, clipped by the corridor floor) ─────────
  const zA = zt - 0.02, top = (z) => ramp(z) - 0.13, bot = (z) => ramp(z) - 0.40;
  const poly = [[zA, top(zA)], [zf - 0.13 / slope, S.yFoot], [zf - 0.40 / slope, S.yFoot], [zA, bot(zA)]].map(([z, y]) => [-z, y]);
  for (const x of [xL + 0.025, xR - 0.025]) kit.extrude('trim', poly, 0.05, { pos: [x, 0, 0], rot: [0, Math.PI / 2, 0] });
  kit.box('trim', [xc, 1.18, zt - 0.03], [0.95, 0.22, 0.06], { bev: 0.004 });                       // landing beam under the top edge
  for (let i = 1; i <= N; i += 2) { const zc = zf - (i - 0.5) * run, yt = S.yFoot + (i - 0.5) * rise; kit.box('darkMetal', [xc, yt - 0.075, zc], [0.84, 0.03, 0.04], { bev: 0.004 }); }   // cross ties

  // ───────── handrails: corridor side (posts + top + mid rail + under-light) and wall side (on brackets) ─────────
  const rz0 = zf - 0.05, hl = (z) => ramp(z) + 0.92, xr = xL + 0.04;
  bar('metal', [xr, hl(rz0), rz0], [xr, hl(GZ), GZ], 0.022); bar('metal', [xr, hl(rz0) - 0.46, rz0], [xr, hl(GZ) - 0.46, GZ], 0.011);
  kit.beam('emitStrip', [xr + 0.026, hl(rz0) - 0.03, rz0 - 0.1], [xr + 0.026, hl(GZ) - 0.03, GZ], 0.005, 0.005, { bev: 0 });
  kit.sphere('metal', [xr, hl(rz0), rz0], 0.026, { seg: 10 });
  for (const i of [1, 3, 6, 9, 12]) { const zc = zf - (i - 0.5) * run, yt = S.yFoot + (i - 0.5) * rise; post('metal', xr, yt, zc, 0.92, 0.013); kit.cyl('trim', [xr, yt + 0.006, zc], 0.03, 0.012, { seg: 10 }); }
  post('trim', xr, S.yFoot, zf + 0.05, 1.1, 0.04); kit.cyl('emitCyan', [xr, S.yFoot + 1.11, zf + 0.05], 0.025, 0.008, { seg: 10 });   // foot newel
  const wx = xR - 0.135;                                                  // clear of the corridor's own wall rail (x = 1.01) so the two never fuse
  bar('metal', [wx, hl(rz0), rz0], [wx, hl(GZ), GZ], 0.02);
  for (const z of [11.9, 10.7, 9.5]) kit.box('trim', [xR - 0.0675, hl(z), z], [0.135, 0.04, 0.05], { bev: 0.004 });
  kit.sphere('metal', [wx, hl(rz0), rz0], 0.024, { seg: 10 });
  bar('metal', [xr, hl(GZ), GZ], [xL - 0.025, hl(GZ), GZ], 0.016); bar('metal', [wx, hl(GZ), GZ], [xR + 0.025, hl(GZ), GZ], 0.016);   // rails end at the gate newels

  // ───────── overhead hatch frame at the ceiling opening ─────────
  const lipC = [[xL - 0.04, (HZ0 + HZ1) / 2, 0.08, HZ1 - HZ0 + 0.16], [xR + 0.04, (HZ0 + HZ1) / 2, 0.08, HZ1 - HZ0 + 0.16], [xc, HZ0 - 0.04, xR - xL, 0.08], [xc, HZ1 + 0.04, xR - xL, 0.08]];
  for (const [x, z, w, d] of lipC) { kit.box('trim', [x, yU - 0.02, z], [w, 0.04, d], { bev: 0.004 }); kit.box('hazard', [x, yU - 0.0415, z], [w - 0.012, 0.003, d - 0.012], { bev: 0 }); }
  for (const [x, z, w, d] of [[xL + 0.002, (HZ0 + HZ1) / 2, 0.012, HZ1 - HZ0], [xR - 0.002, (HZ0 + HZ1) / 2, 0.012, HZ1 - HZ0], [xc, HZ0 + 0.002, xR - xL, 0.012], [xc, HZ1 - 0.002, xR - xL, 0.012]]) {
    kit.box('darkMetal', [x, 1.355, z], [w, 0.09, d], { bev: 0.002 });                               // lining over the raw slab edge
    kit.box('emitStrip', [x + (w < 0.1 ? (x < xc ? 0.0075 : -0.0075) : 0), 1.37, z + (d < 0.1 ? (z < (HZ0 + HZ1) / 2 ? 0.0075 : -0.0075) : 0)], [w < 0.1 ? 0.004 : w - 0.04, 0.014, d < 0.1 ? 0.004 : d - 0.04], { bev: 0 });
  }
  kit.cyl('emitWarm', [xc, yU - 0.006, 12.0], 0.055, 0.012, { seg: 14 }); kit.cyl('trim', [xc, yU - 0.001, 12.0], 0.075, 0.01, { seg: 14 });

  // ───────── safety rail around the opening on the dome deck (gate gap at the top: z 7.9 … GZ) ─────────
  const rail = (x0, z0, x1, z1) => {                                                           // 1.0 m guard rail on the deck; posts every ≤ 0.9 m
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 0.9)); const yh = DK + 1.0;
    for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; post('metal', x, DK, z, 1.0, 0.016); kit.cyl('trim', [x, DK + 0.008, z], 0.035, 0.016, { seg: 10 }); }
    bar('metal', [x0, yh, z0], [x1, yh, z1], 0.024); bar('metal', [x0, DK + 0.5, z0], [x1, DK + 0.5, z1], 0.011);
    kit.beam('trim', [x0, DK + 0.075, z0], [x1, DK + 0.075, z1], 0.012, 0.1, { bev: 0.002 });
    kit.beam('emitStrip', [x0, yh + 0.022, z0], [x1, yh + 0.022, z1], 0.004, 0.004, { bev: 0 });
  };
  const rx0 = xL - 0.025, rx1 = xR + 0.025, rz1 = HZ1 + 0.03;
  rail(rx0, GZ, rx0, rz1); rail(rx0, rz1, rx1, rz1); rail(rx1, rz1, rx1, GZ);
  for (const x of [rx0, rx1]) { post('trim', x, DK, GZ, 1.14, 0.034); kit.cyl(x < xc ? kit.led('Green') : kit.led('Amber', 'Blink'), [x, DK + 1.155, GZ], 0.02, 0.012, { seg: 8 }); kit.cyl('paintOrange', [x, DK + 1.0, GZ], 0.036, 0.05, { seg: 10 }); }
  { const A = new Acc(); const m = 0.075;                                                       // light line along the opening edge on the deck
    flatSeg(A, xL - m, GZ, xL - m, HZ1 + m, 0.012, DK + 0.0125); flatSeg(A, xL - m, HZ1 + m, xR + m, HZ1 + m, 0.012, DK + 0.0125); flatSeg(A, xR + m, HZ1 + m, xR + m, GZ, 0.012, DK + 0.0125);
    kit.arrays('emitStripO', A.arrays); }

  // ───────── colliders (rails + the volume under the stair so nobody walks into it from the corridor) ─────────
  const zu0 = 8.9, zu1 = 11.6, yu = ramp(zu1 + 0.3) + 0.1;           // box top: a stair walker (feet on the ramp, capsule 0.3 clear of the box) is never blocked; a corridor-floor walker always is
  kit.colBox([xc, (S.yFoot + yu) / 2, (zu0 + zu1) / 2], [xR - xL, yu - S.yFoot, zu1 - zu0], { name: 'stair.under' });
  for (const [a, b] of [[GZ, 9.72], [9.72, 10.82], [10.82, 11.92]]) kit.colBox([xL + 0.04, (ramp(b) + 0.5 + ramp(a) + 0.9) / 2, (a + b) / 2], [0.05, ramp(a) + 0.9 - ramp(b) - 0.5, b - a], { name: 'stair.rail' });
  kit.colBox([rx0, DK + 0.6, (GZ + rz1) / 2], [0.07, 1.0, rz1 - GZ], { name: 'dome.rail.l' });
  kit.colBox([rx1, DK + 0.6, (GZ + rz1) / 2], [0.07, 1.0, rz1 - GZ], { name: 'dome.rail.r' });
  kit.colBox([xc, DK + 0.6, rz1], [rx1 - rx0, 1.0, 0.07], { name: 'dome.rail.a' });
  kit.colCyl([xL + 0.04, S.yFoot + 0.55, zf + 0.05], 0.05, 1.1, { name: 'stair.newel' });
}
