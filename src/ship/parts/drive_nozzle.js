// Torch nozzle, static shell: forged throat, regen jacket, exit skirt, flanges, stiffening rings, rolled lip,
// cooling-tube bundles between two manifolds, heat-shield tile rows. B = bellContour(L.DRIVE).
import { AY, boxM, ring, wallFrame } from './drive_util.js';

export default function buildNozzle(kit, B) {
  const lathe = (mat, prof, seg = 72) => kit.lathe(mat, prof, { pos: [0, AY, 0], rot: [Math.PI / 2, 0, 0], seg, ext: true });
  const washer = (mat, t, o0, o1, th) => {                  // flat flange ring (axis z) at parameter t, radial offsets o0..o1 from the wall radius
    const p = B.pt(t);
    lathe(mat, [[p.r + o0, p.z - th / 2], [p.r + o1, p.z - th / 2], [p.r + o1, p.z + th / 2], [p.r + o0, p.z + th / 2]], 72);
  };

  // ───────── skin ─────────
  lathe('driveForge', B.prof(14, 0.085, 0, 0.30));
  lathe('driveShell', B.prof(28, 0.105, 0.30, 0.80), 80);
  lathe('driveShell', B.prof(16, 0.125, 0.80, 1.0));

  // ───────── flanges, stiffening rings, rolled exit lip ─────────
  for (const [t, o1, th] of [[0.30, 0.26, 0.06], [0.80, 0.28, 0.06], [0.55, 0.19, 0.04]]) {
    washer('darkMetal', t, 0.02, o1, th);
    const p = B.pt(t); ring(kit, 'darkMetal', p.r + o1, th * 0.62, p.z, { seg: 72, tube: 6 });
    ring(kit, 'driveCopper', p.r + o1 * 0.5, 0.022, p.z + th * 0.5 + 0.012, { seg: 72, tube: 5 });
  }
  { const p = B.pt(1.0); ring(kit, 'darkMetal', p.r + 0.07, 0.1, p.z - 0.02, { seg: 80, tube: 10 }); ring(kit, 'driveCopper', p.r + 0.07, 0.03, p.z + 0.075, { seg: 80, tube: 6 }); ring(kit, 'emitStrip', p.r + 0.07, 0.011, p.z + 0.1, { seg: 80, tube: 5 }); }
  { const p = B.pt(0.955); ring(kit, 'emitStripO', p.r + 0.15, 0.014, p.z, { seg: 80, tube: 5 }); ring(kit, 'paintOrange', p.r + 0.14, 0.04, p.z - 0.07, { seg: 80, tube: 6 }); }
  { const p = B.pt(0.0); ring(kit, 'driveForge', p.r + 0.14, 0.07, p.z + 0.02, { seg: 56, tube: 8 }); }

  // ───────── regenerative-cooling tube bundles (12 × 3), fed from a manifold ring at t=0.36 and drained at t=0.92 ─────────
  const bund = 12;
  for (let k = 0; k < bund; k++) for (let j = -1; j <= 1; j++) {
    const a = k / bund * Math.PI * 2 + j * 0.042;
    const pts = B.prof(8, 0.135, 0.36, 0.92).map(([r, z]) => [r * Math.cos(a), AY + r * Math.sin(a), z]);
    kit.tube('driveCopper', pts, 0.026, { seg: 14, rseg: 5, ext: true });
  }
  for (const t of [0.36, 0.92]) {
    const p = B.pt(t); ring(kit, 'driveSteel', p.r + 0.135, 0.062, p.z, { seg: 72, tube: 8 });
    for (let k = 0; k < bund; k++) boxM(kit, 'darkMetal', wallFrame(B, t, k / bund * Math.PI * 2, 0.15), 0.2, 0.07, 0.12, 0.012);   // clamp where each bundle meets the manifold
  }

  // ───────── heat-shield tile rows on the throat forging (dark ceramic on the bronze skin; the heat-sink fin pack sits between t=0.08 and 0.17) ─────────
  [0.04, 0.205, 0.255].forEach((t, row) => {
    const p = B.pt(t), n = Math.round(p.r * 20);              // tile count grows with the radius
    for (let k = 0; k < n; k++) boxM(kit, 'driveTile', wallFrame(B, t, (k + (row & 1) * 0.5) / n * Math.PI * 2, 0.105), Math.PI * 2 * (p.r + 0.1) / n * 0.84, 0.04, 0.25, 0);
  });
}
