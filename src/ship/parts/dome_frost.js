// EURYDICE variant of the dome: frost creeping up the glass from the rim (polar frost texture), cracked panels, icicles under the rings, dangling cable.
import * as THREE from 'three';
import { TAU } from './dome_util.js';

const DEG = Math.PI / 180;

function frostTex(T) {                                                    // u = azimuth, v = rim (bottom) → apex (top)
  const W = 2048, H = 512, c = T.cvs(W, H), g = c.getContext('2d'), R = T.mulberry(0xf20a);
  g.clearRect(0, 0, W, H);
  const hz = g.createLinearGradient(0, H, 0, 0); hz.addColorStop(0, 'rgba(214,234,250,0.72)'); hz.addColorStop(0.16, 'rgba(214,234,250,0.4)'); hz.addColorStop(0.45, 'rgba(214,234,250,0.07)'); hz.addColorStop(1, 'rgba(214,234,250,0)');
  g.fillStyle = hz; g.fillRect(0, 0, W, H);
  g.lineCap = 'round';
  const branch = (x, y, a, len, w, d) => {
    if (d > 3 || len < 5) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.strokeStyle = `rgba(228,244,255,${0.6 - d * 0.09})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    const n = 2 + ((R() * 2) | 0);
    for (let i = 0; i < n; i++) { const t = 0.3 + R() * 0.65; branch(x + (x2 - x) * t, y + (y2 - y) * t, a + (R() - 0.5) * 2.2, len * (0.42 + R() * 0.26), w * 0.72, d + 1); }
  };
  for (let k = 0; k < 46; k++) { const x = R() * W, y = H - R() * 60, r = 40 + R() * 90, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(225,242,255,0.34)'); gr.addColorStop(1, 'rgba(225,242,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }   // rime patches
  for (let i = 0; i < 140; i++) { const x = R() * W; for (const o of [-W, 0, W]) branch(x + o, H, -Math.PI / 2 + (R() - 0.5) * 1.0, 28 + R() * 105, 2.6, 0); }
  for (let i = 0; i < 5200; i++) { const y = H * (1 - Math.pow(R(), 2.4)); g.fillStyle = `rgba(238,250,255,${R() * 0.34})`; g.fillRect(R() * W, y, 1 + R() * 2.6, 1 + R() * 2.6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

function crackTex(T, seed) {                                              // radiating, zig-zag cracks around an impact point
  const S = 512, c = T.cvs(S, S), g = c.getContext('2d'), R = T.mulberry(seed), ox = S * (0.42 + R() * 0.16), oy = S * (0.42 + R() * 0.16);
  g.clearRect(0, 0, S, S); g.lineCap = 'round'; g.lineJoin = 'round';
  const crack = (x, y, a, len, w, d) => {
    let px = x, py = y, ca = a;
    for (let i = 0, n = Math.max(3, (len / 13) | 0); i < n; i++) {
      ca += (R() - 0.5) * 0.42; const l = 12 + R() * 14, nx = px + Math.cos(ca) * l, ny = py + Math.sin(ca) * l;
      g.strokeStyle = 'rgba(150,200,235,0.3)'; g.lineWidth = w * 3; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      g.strokeStyle = `rgba(240,250,255,${0.95 - d * 0.18})`; g.lineWidth = w; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      if (d < 2 && R() < 0.15) crack(nx, ny, ca + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), len * 0.5, w * 0.7, d + 1);
      px = nx; py = ny;
    }
  };
  for (let i = 0; i < 9; i++) crack(ox, oy, i / 9 * TAU + R() * 0.5, 190 + R() * 120, 3.6, 0);
  for (const r of [26, 52, 90]) { g.strokeStyle = 'rgba(240,250,255,0.7)'; g.lineWidth = 2; g.beginPath(); for (let a = 0; a < TAU; a += 0.35) { const rr = r * (0.86 + R() * 0.28); g.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr); } g.closePath(); g.stroke(); }
  const gl = g.createRadialGradient(ox, oy, 0, ox, oy, 46); gl.addColorStop(0, 'rgba(255,255,255,0.75)'); gl.addColorStop(1, 'rgba(210,235,255,0)'); g.fillStyle = gl; g.fillRect(ox - 46, oy - 46, 92, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export default function build(kit) {
  if (!kit.eur) return;
  const D = kit.L.DOME, cx = D.cx, cz = D.cz, R = D.r, Y0 = D.collarY, T = kit.T, rnd = kit.rand(0xe041);
  const fTex = frostTex(T), cTex = [crackTex(T, 0x77a1), crackTex(T, 0x31c9)];
  kit.defMat('domeFrost', { tex: () => ({ map: fTex }), uv: 'own', color: 0xe8f3ff, rough: 0.55, metal: 0, transparent: true, opacity: 0.86, doubleSide: true });
  { const g = new THREE.SphereGeometry(R + 0.012, 96, 24, 0, TAU, 0, Math.PI / 2); kit.add('domeFrost', g, { pos: [cx, Y0, cz], ext: true }); g.dispose(); }
  // cracked panels: sphere patches carrying the crack texture; phi = π − azimuth
  cTex.forEach((tx, i) => {
    kit.defMat(`domeCrack${i}`, { tex: () => ({ map: tx }), uv: 'own', color: 0xffffff, rough: 0.2, metal: 0, transparent: true, opacity: 1, doubleSide: true });
    const [az, e0, e1, half] = i ? [72, 8, 38, 20] : [212, 22, 54, 23], phi0 = Math.PI - (az + half) * DEG;
    const g = new THREE.SphereGeometry(R + 0.007, 24, 16, phi0, 2 * half * DEG, (90 - e1) * DEG, (e1 - e0) * DEG);
    kit.add(`domeCrack${i}`, g, { pos: [cx, Y0, cz], ext: true }); g.dispose();
  });
  // icicles under the lowest ring and the bezel lip, and a cable hanging from the apex sensor
  kit.defMat('domeIce', { color: 0xcfe6fa, rough: 0.15, metal: 0, transparent: true, opacity: 0.8 });
  const cone = (x, y, z, len, r) => { const g = new THREE.ConeGeometry(r, len, 6, 1); kit.add('domeIce', g, { pos: [x, y - len / 2, z], rot: [Math.PI, 0, 0] }); g.dispose(); };
  const e18 = 18 * DEG;
  for (let i = 0; i < 36; i++) { const a = rnd() * TAU, r = R * Math.cos(e18) - 0.035 + (rnd() - 0.5) * 0.04; cone(cx + r * Math.cos(a), Y0 + R * Math.sin(e18) - 0.03, cz + r * Math.sin(a), 0.07 + rnd() * 0.38, 0.012 + rnd() * 0.012); }
  for (let i = 0; i < 22; i++) { const a = rnd() * TAU, r = 2.49; cone(cx + r * Math.cos(a), Y0 + 0.0, cz + r * Math.sin(a), 0.05 + rnd() * 0.2, 0.01 + rnd() * 0.01); }
  kit.tube('rubber', [[cx + 0.04, Y0 + 2.44, cz + 0.02], [cx + 0.09, Y0 + 2.0, cz + 0.05], [cx + 0.03, Y0 + 1.6, cz - 0.07], [cx - 0.06, Y0 + 1.3, cz - 0.04]], 0.007, { seg: 20, rseg: 6 });
}
