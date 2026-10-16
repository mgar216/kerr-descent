// CARGO BAY — stowed crates (stencils, straps, nets), tool wall + bench, fire suppression, cable reels, wall ribs/rails/E-track, ceiling runs.
import { frame } from './bay_util.js';

export default function stow(kit, C) {
  const L = kit.L, FLOOR = L.FLOOR, CEIL = L.CEIL, eur = kit.eur, ZF = C.ZF, ZA = C.ZA, W = frame(kit, [0, 0, 0], 0);
  const R = kit.rand(0x5c4a);

  // ───────── structural dressing on the side walls: ribs, rub rail, strap tracks, big stencils ─────────
  for (const sx of [-1, 1]) {
    const xw = sx * C.WX;
    for (const z of (sx < 0 ? [25.4, 26.9, 29.1, 30.6] : [30.6])) { W.box('wallDark', [xw - sx * 0.03, 0.075, z], [0.06, 2.55, 0.22], { bev: 0.006 }); W.box('paintOrange', [xw - sx * 0.032, -0.55, z], [0.064, 0.05, 0.226], { bev: 0.004 }); }
    const rail = (y, a, b, mat, th, h) => W.box(mat, [xw - sx * th / 2, y, (a + b) / 2], [th, h, b - a], { bev: th > 0.03 ? 0.008 : 0 });
    if (sx < 0) { rail(-0.7, 24.2, 30.85, 'darkMetal', 0.05, 0.1); rail(0.3, 24.2, 27.5, 'abTrack', 0.026, 0.045); rail(0.3, 28.5, 30.85, 'abTrack', 0.026, 0.045); }
    else { rail(-0.7, 24.2, 25.25, 'darkMetal', 0.05, 0.1); rail(-0.7, 29.75, 30.85, 'darkMetal', 0.05, 0.1); rail(0.3, 24.2, 25.25, 'abTrack', 0.026, 0.045); rail(0.3, 29.75, 30.85, 'abTrack', 0.026, 0.045); }
    W.st('bay', [xw - sx * 0.004, 0.97, 27.6], [1.5, 0.33], { ry: sx < 0 ? Math.PI / 2 : -Math.PI / 2 });
    W.st(sx < 0 ? (eur ? 'eur1' : 'hx') : 'frame', [xw - sx * 0.004, 0.72, 25.1], [0.6, 0.22], { ry: sx < 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  // hazard bands framing the two doors (wall faces)
  for (const x of [-1.12, 1.12]) W.box('hazard', [x, 0.0, ZF + 0.004], [0.14, 2.2, 0.008], { bev: 0 });
  for (const x of [1.58, 3.22]) W.box('hazard', [x, 0.0, ZA - 0.004], [0.14, 2.2, 0.008], { bev: 0 });
  W.box('hazard', [2.4, FLOOR + 0.006, ZA - 0.3], [1.1, 0.012, 0.5], { bev: 0 });
  W.st('dg', [-2.55, 0.5, ZA - 0.004], [0.3, 0.3], { ry: Math.PI });
  W.st('rad', [-1.8, 0.5, ZA - 0.004], [0.22, 0.22], { ry: Math.PI });
  // ceiling: spine pipes continue from the corridor (cyan port / orange starboard), fire-suppression main + sprinkler heads
  for (const sx of [-1, 1]) {
    W.beam(sx < 0 ? 'paintCyan' : 'paintOrange', [sx * 0.9, CEIL - 0.14, ZF - 0.1], [sx * 0.9, CEIL - 0.14, ZA], 0.07, 0.07, { bev: 0.02 });
    W.beam('metal', [sx * 0.78, CEIL - 0.12, ZF - 0.1], [sx * 0.78, CEIL - 0.12, ZA], 0.04, 0.04, { bev: 0.012 });
    for (let z = 24.5; z < ZA; z += 1.2) W.box('trim', [sx * 0.84, CEIL - 0.1, z], [0.2, 0.2, 0.06], { bev: 0.006 });
  }
  W.pipe('abRed', [[3.05, CEIL - 0.12, 24.4], [3.05, CEIL - 0.12, ZA - 0.05]], 0.03, { fl: 1.4, fmat: 'steel' });
  for (const z of [25.4, 27.2, 29.0, 30.4]) { W.cyl('steel', [3.05, CEIL - 0.2, z], 0.012, 0.1, { seg: 6 }); W.cyl('steel', [3.05, CEIL - 0.26, z], 0.045, 0.012, { seg: 12 }); W.box('abRed', [3.05, CEIL - 0.15, z + 0.0], [0.06, 0.03, 0.06], { bev: 0.004 }); }
  W.pipe('abRed', [[3.05, CEIL - 0.12, 24.4], [1.6, CEIL - 0.12, 24.4], [1.6, CEIL - 0.12, ZF + 0.02], [1.6, 0.52, ZF + 0.02]], 0.03, { fmat: 'steel' });

  // ───────── fire suppression station (forward bulkhead, right of the door) ─────────
  {
    const f = frame(kit, [1.6, FLOOR, ZF + 0.005], 0);
    f.box('abRed', [0, 1.55, 0.06], [0.52, 0.92, 0.12], { bev: 0.01 });
    f.box('trim', [0, 1.55, 0.125], [0.46, 0.86, 0.012], { bev: 0.004 });
    f.box('glassMed', [0, 1.55, 0.134], [0.42, 0.82, 0.006], { bev: 0 });
    f.cyl('abRed', [-0.09, 1.4, 0.07], 0.07, 0.5, { seg: 14 }); f.sph('abRed', [-0.09, 1.65, 0.07], 0.07, { seg: 12, th: Math.PI / 2 });
    f.cyl('trim', [-0.09, 1.7, 0.07], 0.02, 0.06, { seg: 8 }); f.box('trim', [-0.09, 1.74, 0.1], [0.04, 0.02, 0.1], { bev: 0.004 });
    f.cyl('abYellow', [0.14, 1.4, 0.06], 0.05, 0.4, { seg: 12 }); f.torus('rubber', [0.14, 1.1, 0.06], 0.07, 0.014, { axis: 'z', tube: 5, seg: 16 });
    f.st('fire', [0, 2.12, 0.012], [0.5, 0.25], {});
    f.box(kit.led('Green', ''), [0.2, 1.2, 0.14], [0.012, 0.012, 0.004], { bev: 0 });
  }

  // ───────── tool wall + workbench (forward bulkhead, left of the door) ─────────
  {
    const bx = -2.5, by = 0.12, tb = frame(kit, [bx - 0.88, by + 0.56, ZF + 0.005], 0);
    W.box('plasticDark', [bx, by, ZF + 0.02], [1.84, 1.2, 0.03], { bev: 0.008 });
    W.st('tool', [bx, by, ZF + 0.0365], [1.76, 1.12], {});
    for (const sx of [-1, 1]) W.box('trim', [bx + sx * 0.93, by, ZF + 0.03], [0.03, 1.22, 0.05], { bev: 0.006 });
    for (const sy of [-1, 1]) W.box('trim', [bx, by + sy * 0.61, ZF + 0.03], [1.9, 0.03, 0.05], { bev: 0.006 });
    const px = (x, y, z = 0.05) => [x / 400, -y / 400, z];
    [[70, 190], [110, 160], [150, 130], [190, 110]].forEach(([y, len]) => {
      tb.box('steel', [60 / 400 + len / 800, -y / 400, 0.052], [len / 400, 0.022, 0.012], { bev: 0.003 });
      tb.torus('steel', [0.13, -y / 400, 0.052], 0.032, 0.008, { axis: 'z', tube: 4, seg: 10 }); tb.box('steel', [(60 + len + 8) / 400, -y / 400, 0.052], [0.04, 0.036, 0.012], { bev: 0.003 });
    });
    tb.box('wood', px(395, 170, 0.06), [0.34, 0.024, 0.02], { bev: 0.004 }); tb.box('steel', px(480 - 5, 160, 0.06), [0.09, 0.08, 0.035], { bev: 0.006 });   // hammer
    tb.box('abYellow', px(395, 285, 0.07), [0.22, 0.1, 0.06], { bev: 0.01 }); tb.box('plasticDark', px(395, 300, 0.07), [0.08, 0.14, 0.06], { bev: 0.008 });  // drill
    tb.torus('paintOrange', [1.4, -0.225, 0.07], 0.095, 0.026, { axis: 'z', tube: 5, seg: 16 });                                                         // cable coil
    tb.box('steel', px(430, 262, 0.06), [0.22, 0.014, 0.02], { bev: 0.002 }); tb.box('abRed', px(430, 275, 0.065), [0.2, 0.02, 0.02], { bev: 0.004 });
    tb.box('paintCyan', px(100, 310, 0.065), [0.2, 0.2, 0.045], { bev: 0.01 });
    // bench
    const bf = frame(kit, [bx - 0.15, FLOOR, ZF + 0.3], 0);
    bf.box('white', [0, 0.38, 0], [1.3, 0.76, 0.5], { bev: 0.01, col: true });
    bf.box('steel', [0, 0.78, 0], [1.34, 0.045, 0.54], { bev: 0.008 });
    for (let i = 0; i < 3; i++) { bf.box('plasticDark', [0.18, 0.62 - i * 0.2, 0.256], [0.78, 0.17, 0.008], { bev: 0.003 }); bf.box('paintOrange', [0.18, 0.62 - i * 0.2, 0.264], [0.3, 0.018, 0.012], { bev: 0.003 }); }
    bf.box('trim', [-0.4, 0.38, 0.256], [0.34, 0.7, 0.008], { bev: 0.003 });
    bf.box('paintOrange', [-0.15, 0.89, -0.03], [0.4, 0.14, 0.22], { bev: 0.015 }); bf.box('trim', [-0.15, 0.97, -0.03], [0.1, 0.02, 0.04], { bev: 0.004 });   // toolbox
    bf.box('trim', [0.5, 0.85, -0.05], [0.14, 0.1, 0.12], { bev: 0.006 }); bf.box('steel', [0.5, 0.92, -0.05], [0.06, 0.05, 0.04], { bev: 0.004 });     // vise
    bf.cyl('paintCyan', [0.2, 0.84, -0.12], 0.045, 0.1, { seg: 12 }); bf.cyl('abYellow', [0.3, 0.83, -0.1], 0.04, 0.08, { seg: 12 });
    if (!eur) { bf.cyl('white', [0.42, 0.88, 0.12], 0.04, 0.09, { seg: 14 }); bf.cyl('paintOrange', [0.42, 0.9, 0.12], 0.0415, 0.02, { seg: 14 }); bf.box('abBlue', [0.1, 0.86, 0.12], [0.16, 0.015, 0.2], { bev: 0.003, ry: 0.5 }); bf.box('fabricGrey', [-0.35, 0.86, 0.1], [0.12, 0.02, 0.07], { bev: 0.006, ry: 0.4 }); bf.box('fabricGrey', [-0.23, 0.86, 0.14], [0.12, 0.02, 0.07], { bev: 0.006, ry: -0.3 }); }
  }

  // ───────── cable reels (starboard-forward corner) ─────────
  for (const [x, z] of [[2.55, 24.5], [3.15, 24.5]]) {
    const f = frame(kit, [x, FLOOR, z], 0);
    for (const dz of [-0.15, 0.15]) f.cyl('steel', [0, 0.36, dz], 0.34, 0.03, { axis: 'z', seg: 22 });
    f.cyl(x < 3 ? 'paintOrange' : 'rubber', [0, 0.36, 0], 0.24, 0.27, { axis: 'z', seg: 20 });
    f.cyl('trim', [0, 0.36, 0], 0.08, 0.38, { axis: 'z', seg: 10 });
    for (const dz of [-0.19, 0.19]) { f.box('trim', [-0.2, 0.18, dz], [0.04, 0.36, 0.04], { bev: 0.006, rz: -0.35 }); f.box('trim', [0.2, 0.18, dz], [0.04, 0.36, 0.04], { bev: 0.006, rz: 0.35 }); }
    f.box('trim', [0, 0.02, 0], [0.5, 0.03, 0.46], { bev: 0.004 });
    f.tube('rubber', [[0.24, 0.3, 0.12], [0.36, 0.08, 0.24], [0.5, 0.02, 0.4]], 0.016, { seg: 10, rseg: 5 });
    f.col([0, 0.36, 0], [0.7, 0.72, 0.44]);
  }

  // ───────── crates: aft-port stack + aft-starboard stack ─────────
  const crates = [
    { p: [-2.95, FLOOR + 0.4, 30.36], s: [0.98, 0.8, 1.0], m: 'abCrateOlive', yaw: 0.0, f: ['sk', 'hoist'], faces: ['b', 'r'], strap: true },
    { p: [-2.98, FLOOR + 0.8 + 0.27, 30.38], s: [0.84, 0.54, 0.86], m: 'abCrateGrey', yaw: 0.1, f: ['core', 'frag'], faces: ['b', 'r'], net: true },
    { p: [-2.0, FLOOR + 0.25, 30.5], s: [0.55, 0.5, 0.62], m: 'abCrateTan', yaw: -0.22, f: ['n2', 'max'], faces: ['b', 'r'] },
    { p: [3.15, FLOOR + 0.35, 30.45], s: [0.66, 0.7, 0.8], m: 'abCrateOlive', yaw: 0.0, f: ['spares', 'tup'], faces: ['b', 'l'], strap: true },
    { p: [3.18, FLOOR + 0.7 + 0.22, 30.42], s: [0.56, 0.44, 0.7], m: 'abCrateGrey', yaw: -0.08, f: [eur ? 'eur1' : 'food', 'max'], faces: ['b', 'l'] },
  ];
  crates.forEach((c, i) => crate(kit, c, eur && i === 1, R));
  kit.colBox([-2.8, FLOOR + 0.65, 30.4], [1.3, 1.3, 1.05]);
  kit.colBox([-2.0, FLOOR + 0.25, 30.5], [0.7, 0.5, 0.75]);
  kit.colBox([3.17, FLOOR + 0.55, 30.43], [0.75, 1.1, 0.85]);
  // cargo net over the lane-facing side of the port stack
  const nf = frame(kit, [-2.45, FLOOR + 0.68, 30.4], 0);
  nf.plane('abNet', [0, 0, 0], 0.98, 1.3, { ry: Math.PI / 2 });
  for (const dz of [-0.46, 0.46]) for (const dy of [-0.6, 0.6]) nf.cyl('steel', [0.01, dy, dz], 0.018, 0.014, { axis: 'x', seg: 8 });
  // coiled straps on wall hooks above the port stack
  for (let i = 0; i < 3; i++) { const f = frame(kit, [-3.5, 0.55, 29.95 + i * 0.35], 0); f.box('trim', [0, 0.1, 0], [0.04, 0.02, 0.04], { bev: 0.003 }); f.torus(i === 1 ? 'fabricGrey' : 'fabricOrange', [-0.03, 0.0, 0], 0.09, 0.028, { axis: 'x', tube: 5, seg: 14 }); f.box('steel', [-0.07, -0.1, 0], [0.04, 0.05, 0.06], { bev: 0.004 }); }
}

// one strapped shipping crate in its own local frame; faces: 'f' +z, 'b' −z, 'r' +x, 'l' −x
function crate(kit, c, opened, R) {
  const [w, h, d] = c.s, f = frame(kit, c.p, c.yaw);
  f.box(c.m, [0, 0, 0], c.s, { bev: 0.016 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.box('trim', [sx * (w / 2 - 0.018), 0, sz * (d / 2 - 0.018)], [0.045, h + 0.012, 0.045], { bev: 0.006 });
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) f.box('trim', [0, sy * (h / 2 - 0.018), sz * (d / 2 - 0.018)], [w - 0.05, 0.04, 0.045], { bev: 0.006 });
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) f.box('trim', [sx * (w / 2 - 0.018), sy * (h / 2 - 0.018), 0], [0.045, 0.04, d - 0.05], { bev: 0.006 });
  f.box('trim', [0, h / 2 - 0.16, 0], [w + 0.006, 0.012, d + 0.006], { bev: 0.002 });
  for (const sx of [-0.2 * w, 0.2 * w]) { f.box('steel', [sx, h / 2 - 0.16, -d / 2 - 0.008], [0.07, 0.05, 0.02], { bev: 0.004 }); f.box('paintOrange', [sx, h / 2 - 0.2, -d / 2 - 0.014], [0.03, 0.04, 0.012], { bev: 0.003 }); }
  for (const s of [-1, 1]) f.box('steel', [0, 0.0, s * (d / 2 + 0.012)], [0.16, 0.025, 0.02], { bev: 0.004 });
  const face = { f: [[0, 0.04, d / 2 + 0.005], {}], b: [[0, 0.04, -d / 2 - 0.005], { ry: Math.PI }], r: [[w / 2 + 0.005, 0.04, 0], { ry: Math.PI / 2 }], l: [[-w / 2 - 0.005, 0.04, 0], { ry: -Math.PI / 2 }] };
  c.faces.forEach((k, i) => { const [p, o] = face[k], wd = k === 'f' || k === 'b' ? w : d; f.st(c.f[i], p, [Math.min(0.5, wd * 0.8), Math.min(0.5, wd * 0.8) * 96 / 256], o); });
  f.st('dg', [-w * 0.3, -h * 0.25, -d / 2 - 0.005], [0.14, 0.14], { ry: Math.PI });
  if (c.strap) for (const sx of [-0.25 * w, 0.25 * w]) {
    f.box('fabricOrange', [sx, h / 2 + 0.004, 0], [0.05, 0.008, d + 0.01], { bev: 0 }); f.box('fabricOrange', [sx, 0, d / 2 + 0.004], [0.05, h + 0.01, 0.008], { bev: 0 }); f.box('fabricOrange', [sx, 0, -d / 2 - 0.004], [0.05, h + 0.01, 0.008], { bev: 0 });
    f.box('steel', [sx, h * 0.18, -d / 2 - 0.012], [0.08, 0.05, 0.02], { bev: 0.004 });
  }
  if (c.net) { f.plane('abNet', [0, 0, -d / 2 - 0.014], w + 0.02, h + 0.02, { ry: Math.PI }); }
  if (opened) {   // derelict: lid ajar, contents spilled
    f.box(c.m, [0.15, h / 2 + 0.12, 0], [w * 0.9, 0.04, d * 0.98], { bev: 0.01, rz: 0.35 });
    f.box('fabricGrey', [0.1, h / 2 - 0.02, 0], [w * 0.6, 0.1, d * 0.5], { bev: 0.02 });
  }
}
