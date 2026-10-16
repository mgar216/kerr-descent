// Flight deck extras: ceiling dressing (ribs following the slope, utility pipes, camera dome) + lived-in personal props (ORPHEUS only).
import * as THREE from 'three';

const PI = Math.PI;
export default function build(kit, U) {
  const { box, cyl, sph, torus, tube, at, frame } = U, T = kit.T, L = kit.L, eur = kit.eur, ceil = L.flightdeckCeil, ID = frame();
  // ── ceiling ribs (tilted with the roof), pipe runs with brackets, camera dome ──
  const slope = Math.atan((ceil(2.4) - ceil(0.35)) / 2.05);
  for (const z of [0.72, 1.0, 1.98, 2.22]) { const hw = L.flightdeckHW(z) - 0.12; kit.box('trim', [0, ceil(z) - 0.03, z], [2 * hw, 0.05, 0.08], { rot: [-slope, 0, 0], bev: 0.004 }); }
  for (const sx of [-1, 1]) {
    tube(ID, sx < 0 ? 'paintCyan' : 'paintOrange', [0.55, 1.0, 1.5, 2.0, 2.3].map((z) => [sx * 1.3, ceil(z) - 0.09, z]), 0.032, { seg: 20, rseg: 10 });
    tube(ID, 'metal', [0.55, 1.2, 2.3].map((z) => [sx * 1.43, ceil(z) - 0.06, z]), 0.016, { seg: 10, rseg: 6 });
    for (const z of [0.75, 1.3, 1.85]) box(ID, 'trim', [sx * 1.36, ceil(z) - 0.06, z], [0.2, 0.06, 0.05], { bev: 0.008 });
  }
  { const y = ceil(2.15); sph(ID, 'darkMetal', [0, y - 0.012, 2.15], 0.065, { seg: 14, theta: PI / 2, rot: [PI, 0, 0] }); sph(ID, 'glassMed', [0, y - 0.05, 2.15], 0.026, { seg: 8 }); kit.box(kit.led('Red', 'Blink'), [0.035, y - 0.045, 2.15], [0.01, 0.006, 0.01], { bev: 0 }); }
  if (eur) return;

  // ── ORPHEUS personal props: Mira's drawing on the pilot's left cabinet, a mission mug, sticky notes, a pendant under the overhead ──
  {
    const W = 256, H = 190, cv = T.cvs(W, H), g = cv.getContext('2d');
    g.fillStyle = '#f2ecdc'; g.fillRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(205, 38, 22, 0, PI * 2); g.fill(); g.strokeStyle = '#f08a00'; g.lineWidth = 3; for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; g.beginPath(); g.moveTo(205 + Math.cos(a) * 28, 38 + Math.sin(a) * 28); g.lineTo(205 + Math.cos(a) * 38, 38 + Math.sin(a) * 38); g.stroke(); }
    g.fillStyle = '#3a2a22'; g.fillRect(198, 32, 4, 4); g.fillRect(210, 32, 4, 4); g.strokeStyle = '#3a2a22'; g.lineWidth = 2.5; g.beginPath(); g.arc(205, 42, 9, 0.2, PI - 0.2); g.stroke();
    g.fillStyle = '#e8e8ea'; g.strokeStyle = '#33363c'; g.lineWidth = 3; g.beginPath(); g.moveTo(100, 30); g.quadraticCurveTo(128, 70, 122, 130); g.lineTo(78, 130); g.quadraticCurveTo(72, 70, 100, 30); g.fill(); g.stroke();
    g.fillStyle = '#18b8d8'; g.beginPath(); g.arc(100, 78, 13, 0, PI * 2); g.fill(); g.stroke(); g.fillStyle = '#e8742a'; g.beginPath(); g.moveTo(78, 130); g.lineTo(60, 156); g.lineTo(84, 140); g.fill(); g.stroke(); g.beginPath(); g.moveTo(122, 130); g.lineTo(140, 156); g.lineTo(116, 140); g.fill(); g.stroke();
    g.fillStyle = '#ff7a2a'; g.beginPath(); g.moveTo(88, 130); g.lineTo(100, 168); g.lineTo(112, 130); g.fill();
    g.fillStyle = '#18a0c8'; for (const [x, y] of [[30, 40], [58, 22], [160, 80], [30, 100], [175, 140]]) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 - PI / 2, r = i % 2 ? 4 : 9; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); }
    g.strokeStyle = '#d02050'; g.lineWidth = 3; g.beginPath(); g.moveTo(30, 175); g.bezierCurveTo(20, 160, 40, 155, 30, 168); g.bezierCurveTo(20, 155, 45, 150, 30, 175); g.stroke();
    g.fillStyle = '#33363c'; g.font = '700 22px "Comic Sans MS", cursive, sans-serif'; g.fillText('GO ORPHEUS!', 54, 184);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    kit.decal(tex, [-0.951, -1.06, -0.25], [0.2, 0.148], { rot: [0, PI / 2, 0], color: 0xc8c8c8, name: 'mira.drawing' });
    box(frame([-0.953, -1.06, -0.25], PI / 2), 'paintOrange', [-0.085, 0.066, 0.001], [0.03, 0.012, 0.002], { rot: [0, 0, 0.5], bev: 0 }); box(frame([-0.953, -1.06, -0.25], PI / 2), 'paintCyan', [0.09, -0.062, 0.001], [0.03, 0.012, 0.002], { rot: [0, 0, 0.4], bev: 0 });
  }
  {
    const SB = U.sb.W, DESK = U.sb.DESK, TOP = at(SB.fr(-0.47, 0, 0), [0, DESK, 0], { rot: [-PI / 2, 0, 0] }), C = SB.fr(-0.47, 0, 0);
    cyl(TOP, 'ceramic', [0.5, -0.19, 0.0475], 0.038, 0.095, { axis: 'z', seg: 18 }); cyl(TOP, 'leather', [0.5, -0.19, 0.0945], 0.033, 0.002, { axis: 'z', seg: 16 });
    torus(TOP, 'paintOrange', [0.5, -0.19, 0.05], 0.0385, 0.0035, { seg: 20, tube: 4 }); torus(TOP, 'ceramic', [0.538, -0.19, 0.05], 0.026, 0.0055, { arc: PI, rot: [PI / 2, 0, -PI / 2], seg: 12, tube: 5 });
    box(C, 'fdYellow', [-0.5, -0.03, 0.1015], [0.05, 0.05, 0.0015], { rot: [0, 0, 0.12], bev: 0 }); box(C, 'paintOrange', [0.33, -0.015, 0.1015], [0.045, 0.045, 0.0015], { rot: [0, 0, -0.1], bev: 0 }); box(C, 'paintCyan', [-0.2, 0.03, 0.1015], [0.04, 0.04, 0.0015], { rot: [0, 0, 0.05], bev: 0 });
    const OV = U.ov.F, Z = U.ov.Z;
    tube(OV, 'rubber', [[-0.43, -0.385, Z], [-0.43, -0.388, Z + 0.05], [-0.43, -0.385, Z + 0.1]], 0.0022, { seg: 8, rseg: 4 }); sph(OV, 'brass', [-0.43, -0.385, Z + 0.118], 0.016, { seg: 10, scale: [1, 1, 1.25] }); torus(OV, 'paintOrange', [-0.43, -0.385, Z + 0.102], 0.008, 0.0025, { seg: 10, tube: 4 });
  }
}
