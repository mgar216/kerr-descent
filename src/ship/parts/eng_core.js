// ENGINEERING — the drive core: central column, toroidal containment vessel with a flowing plasma band, magnet collars,
// spokes, pylons, coolant risers + collector ring, guard rails. Glow follows D.lvl (thrust/boost) and the lighting mode.
import * as THREE from 'three';
import { frame, dynSink, basicMat } from './bay_util.js';
import { cvs, mulberry } from './textures.js';

function plasmaTexture() {
  const W = 512, H = 32, c = cvs(W, H), g = c.getContext('2d'), R = mulberry(0x9a5a);
  g.fillStyle = '#2f7fb0'; g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(215,246,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 48; i++) { const x = R() * W, len = 14 + R() * 110, y = R() * H, hh = 1 + R() * 4; g.fillStyle = `rgba(235,252,255,${0.25 + R() * 0.75})`; g.fillRect(x, y, len, hh); g.fillRect(x - W, y, len, hh); }
  for (let i = 0; i < 20; i++) { const x = R() * W, len = 30 + R() * 160, y = R() * H; g.fillStyle = 'rgba(8,36,80,0.5)'; g.fillRect(x, y, len, 2 + R() * 3); g.fillRect(x - W, y, len, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 1); t.anisotropy = 4; return t;
}

export default function core(kit, E, D) {
  const FLOOR = kit.L.FLOOR, CEIL = kit.L.CEIL, eur = kit.eur, { cx, cz, cy, R, rr } = E, W = frame(kit, [0, 0, 0], 0);
  const colH = CEIL - FLOOR, colY = (CEIL + FLOOR) / 2, td = Math.atan2(31.0 - cz, 2.4 - cx), TAU = Math.PI * 2;
  const at = (rad, y, t) => [cx + rad * Math.cos(t), y, cz + rad * Math.sin(t)];

  // ───────── platform, hazard ring ─────────
  W.cyl('darkMetal', [cx, FLOOR + 0.02, cz], 1.66, 0.04, { seg: 56 });
  W.lathe('hazard', [[1.9, FLOOR + 0.012], [1.72, FLOOR + 0.012]], { pos: [cx, 0, cz], seg: 56 });
  W.lathe('trim', [[1.915, FLOOR + 0.0], [1.915, FLOOR + 0.03], [1.9, FLOOR + 0.03]], { pos: [cx, 0, cz], seg: 56 });

  // ───────── central column ─────────
  W.cyl('abCeramicDark', [cx, colY, cz], 0.5, colH, { seg: 40 });
  W.cyl('trim', [cx, FLOOR + 0.1, cz], 0.68, 0.2, { seg: 40, rt: 0.52 });
  W.cyl('trim', [cx, CEIL - 0.1, cz], 0.52, 0.2, { seg: 40, rt: 0.74 });
  for (const y of [-0.9, -0.62, 0.62, 0.9, 1.1]) W.torus('abCopper', [cx, y, cz], 0.515, 0.028, { axis: 'y', tube: 5, seg: 28 });
  for (const y of [-0.45, 0.75]) W.cyl('paintOrange', [cx, y, cz], 0.507, 0.06, { seg: 40 });
  for (let k = 0; k < 4; k++) { const t = k * Math.PI / 2 + 0.4; W.box('trim', at(0.53, colY, t), [0.08, colH - 0.3, 0.05], { bev: 0.006, ry: Math.PI / 2 - t }); }
  // nameplate facing the door (above the vessel so it reads from the entrance)
  { const NF = frame(kit, at(0.525, 0.82, td), Math.PI / 2 - td); NF.box('trim', [0, 0, 0], [0.5, 0.17, 0.04], { bev: 0.006 }); NF.st('drive', [0, 0, 0.0215], [0.46, 0.115]); }

  // ───────── toroidal containment vessel (halves + dark slit rims) ─────────
  const a0 = Math.asin(0.05 / rr), rim = 0.4;
  const arc = (from, to, n) => Array.from({ length: n + 1 }, (_, i) => { const a = from + (to - from) * i / n; return [R + rr * Math.cos(a), rr * Math.sin(a)]; });
  const lat = (mat, from, to, n) => W.lathe(mat, arc(from, to, n), { pos: [cx, cy, cz], seg: 48 });
  lat('paintWhite', a0 + rim, Math.PI - a0 - rim, 12); lat('paintWhite', Math.PI + a0 + rim, TAU - a0 - rim, 12);
  for (const [f, t] of [[a0, a0 + rim], [Math.PI - a0 - rim, Math.PI - a0], [Math.PI + a0, Math.PI + a0 + rim], [TAU - a0 - rim, TAU - a0]]) lat('trim', f, t, 4);
  // magnet collars (copper) with dark clamps in between
  for (let k = 0; k < 16; k++) { const t = k * TAU / 16; W.torus('abCopper', at(R, cy, t), rr + 0.036, 0.03, { axis: 'z', ry: -t, tube: 5, seg: 20 }); }
  for (let k = 0; k < 16; k++) { const t = (k + 0.5) * TAU / 16; W.torus('trim', at(R, cy, t), rr + 0.02, 0.016, { axis: 'z', ry: -t, tube: 4, seg: 16 }); }
  if (eur) {   // derelict: scorched, blackened patches on the vessel (partial lathe arcs just above the paint)
    const Rn = kit.rand(0x50a7);
    for (let k = 0; k < 9; k++) {
      const low = k % 3 === 2, lo = low ? Math.PI + a0 + rim + 0.1 : a0 + rim + 0.1, hi = low ? TAU - a0 - rim - 0.1 : Math.PI - a0 - rim - 0.1;
      const aA = lo + Rn() * (hi - lo) * 0.6, aB = Math.min(hi, aA + 0.3 + Rn() * 0.7);
      const prof = Array.from({ length: 7 }, (_, i) => { const a = aA + (aB - aA) * i / 6; return [R + (rr + 0.006) * Math.cos(a), (rr + 0.006) * Math.sin(a)]; });
      W.lathe('abSoot', prof, { pos: [cx, cy, cz], seg: 12, phi0: Rn() * TAU, phi: 0.3 + Rn() * 0.9 });
    }
    for (let k = 0; k < 4; k++) W.cyl('abSoot', [cx, 0.2 + Rn() * 0.9, cz], 0.502, 0.12 + Rn() * 0.25, { seg: 10, tl: 0.8 + Rn() * 0.9, t0: Rn() * TAU, open: true });
  }
  // spokes + gussets from the column hub to the vessel
  for (let k = 0; k < 6; k++) { const t = k * Math.PI / 3 + 0.26; W.beam('trim', at(0.46, cy, t), at(1.04, cy, t), 0.12, 0.1, { bev: 0.01 }); W.beam('steel', at(0.5, cy + 0.09, t), at(0.9, cy + 0.03, t), 0.05, 0.03, { bev: 0.006 }); }
  // pylons + braces under the vessel
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.5) * TAU / 8, p = at(R, FLOOR + 0.5, t);
    W.box('steel', [p[0], FLOOR + 0.5, p[2]], [0.15, 1.0, 0.15], { bev: 0.01, ry: -t });
    W.box('trim', [p[0], FLOOR + 0.05, p[2]], [0.34, 0.05, 0.34], { bev: 0.008, ry: -t });
    W.box('paintOrange', [p[0], FLOOR + 0.98, p[2]], [0.2, 0.04, 0.2], { bev: 0.006, ry: -t });
    W.beam('trim', [p[0], FLOOR + 0.55, p[2]], at(0.62, FLOOR + 0.1, t), 0.06, 0.06, { bev: 0.008 });
  }
  // coolant risers + collector ring at ceiling level (cyan = port half, orange = starboard half); spine pipes from the cargo side meet it
  const ringY = CEIL - 0.14;
  W.torus('paintOrange', [cx, ringY, cz], R, 0.05, { axis: 'y', arc: Math.PI, ry: Math.PI / 2, tube: 8, seg: 36 });
  W.torus('paintCyan', [cx, ringY, cz], R, 0.05, { axis: 'y', arc: Math.PI, ry: -Math.PI / 2, tube: 8, seg: 36 });
  for (let k = 0; k < 8; k++) {
    const t = k * Math.PI / 4 + Math.PI / 8, p = at(R, 0, t), mat = Math.cos(t) >= 0 ? 'paintOrange' : 'paintCyan';
    W.pipe(mat, [[p[0], cy + rr - 0.02, p[2]], [p[0], ringY, p[2]]], 0.034, { fl: 0.4, fmat: 'trim' });
    W.box('trim', [p[0], ringY + 0.075, p[2]], [0.07, 0.1, 0.07], { bev: 0.006 });
  }
  for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4; W.box('trim', at(R, ringY + 0.07, t), [0.14, 0.08, 0.14], { bev: 0.008, ry: -t }); W.cyl('steel', at(R, ringY, t), 0.062, 0.05, { seg: 12 }); }
  // cable bundles up the column
  for (let k = 0; k < 5; k++) { const t = 0.9 + k * 1.15; W.tube('rubber', [at(0.52, 0.1, t), at(0.62, 0.55, t + 0.1), at(0.7, 1.0, t + 0.2), at(0.78, CEIL - 0.03, t + 0.2)], 0.022, { seg: 16, rseg: 6 }); }

  // ───────── guard rails (gaps toward the door and the viewport) ─────────
  const gaps = [td, Math.PI / 2], gw = 0.42, RR = 1.8;
  const inGap = (t) => gaps.some((g) => { const d = Math.abs(((t - g + Math.PI * 3) % TAU) - Math.PI); return d < gw; });
  for (let k = 0; k < 28; k++) { const t = (k + 0.5) * TAU / 28; if (inGap(t)) continue; W.box('abYellow', at(RR, FLOOR + 0.5, t), [0.05, 1.0, 0.05], { bev: 0.006, ry: -t }); W.box('trim', at(RR, FLOOR + 0.02, t), [0.12, 0.04, 0.12], { bev: 0.004, ry: -t }); }
  const gs = gaps.map((g) => ((g % TAU) + TAU) % TAU).sort((a, b) => a - b);
  for (let i = 0; i < gs.length; i++) {
    const t0 = gs[i] + gw, t1 = (i + 1 < gs.length ? gs[i + 1] : gs[0] + TAU) - gw;
    for (const y of [FLOOR + 1.0, FLOOR + 0.5]) W.torus('abYellow', [cx, y, cz], RR, 0.022, { axis: 'y', arc: t1 - t0, ry: -t0, tube: 6, seg: Math.max(12, Math.round((t1 - t0) * 14)) });
  }
  // danger placard on the door-side gate post + radiation/HV pictograms
  { const t = td + gw + 0.06, SF = frame(kit, at(RR + 0.04, FLOOR + 0.7, t), Math.PI / 2 - t); SF.box('trim', [0, 0, 0], [0.56, 0.24, 0.02], { bev: 0.004 }); SF.st('danger', [0, 0, 0.0115], [0.52, 0.2]); SF.st('hv', [0.36, 0, 0.0115], [0.14, 0.14]); }

  // ───────── dynamic glow: plasma band (flowing texture) + cyan accents ─────────
  const plasmaTex = plasmaTexture();
  const plasmaMat = basicMat(0.5, 1.0, 1.1, { map: plasmaTex }), cyanMat = basicMat(0.15, 0.9, 1.0);
  {
    const sk = dynSink(), P = frame(kit, [0, 0, 0], 0, sk), ro = R + rr * Math.cos(a0) - 0.004, ri = R - rr * Math.cos(a0) + 0.004;
    P.lathe('x', [[ro, cy - 0.05], [ro, cy + 0.05]], { pos: [cx, 0, cz], seg: 72 });
    P.lathe('x', [[ri, cy + 0.05], [ri, cy - 0.05]], { pos: [cx, 0, cz], seg: 48 });
    P.torus('x', [cx, cy, cz], R, 0.08, { axis: 'y', tube: 6, seg: 48 });
    kit.mesh(sk.build(), plasmaMat, { name: 'driveTorusPlasma' });
    const ck = dynSink(), C = frame(kit, [0, 0, 0], 0, ck);
    for (let k = 0; k < 8; k++) { const t = (k + 0.5) * Math.PI / 4; for (const [y0, y1] of [[-0.8, -0.35], [0.55, 1.15]]) C.box('x', at(0.505, (y0 + y1) / 2, t), [0.034, y1 - y0, 0.02], { bev: 0, ry: Math.PI / 2 - t }); }
    C.torus('x', [cx, FLOOR + 0.05, cz], 1.52, 0.012, { axis: 'y', tube: 4, seg: 56 });
    C.torus('x', [cx, FLOOR + 0.05, cz], 1.38, 0.008, { axis: 'y', tube: 3, seg: 48 });
    for (let k = 0; k < 8; k++) { const t = (k + 0.5) * TAU / 8; C.box('x', at(R, FLOOR + 0.9, t), [0.02, 0.06, 0.02], { bev: 0, ry: -t }); }
    kit.mesh(ck.build(), cyanMat, { name: 'driveCoreAccent' });
  }
  kit.onUpdate((dt, t) => {
    const lvl = D.lvl, mk = D.mk;
    let k, r, g, b, kc;
    if (eur) { const f = D.fail; k = 0.015 + 1.1 * f; r = 1.0; g = 0.28 + 0.2 * f; b = 0.12 + 0.2 * f; kc = 0.08 + 0.7 * f; }
    else { k = (1.1 + 7.5 * lvl) * mk; r = 0.38 + 0.42 * lvl; g = 0.86 + 0.1 * lvl; b = 1.0; kc = (0.9 + 1.8 * lvl) * mk; }
    plasmaMat.color.setRGB(r * k, g * k, b * k);
    plasmaTex.offset.x -= dt * (eur ? 0.004 : 0.02 + 0.45 * lvl);
    cyanMat.color.setRGB(0.15 * kc, 0.9 * kc, 1.0 * kc);
  });

  // ───────── gameplay ─────────
  kit.colCyl([cx, colY, cz], 1.62, colH);
  const dp = at(R, cy, td);
  kit.interact({ id: 'engineering.drive', label: 'Drive core', pos: dp, radius: 2.2, hit: { c: [cx, cy, cz], s: [3.3, 2.6, 3.3] } });
}
