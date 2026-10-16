// Screen drawing helpers in the cockpit/UI style (cyan on near-black). All take a 2D context + canvas size.
// Usage: kit.screen({ ..., draw: (g, W, H, t, s) => { S.base(g, W, H, t, { title: 'GRAVIMETER' }); … } })
import { FONTS, mulberry } from './textures.js';

export const C = { bg: '#02080d', cy: '#86ecff', cyd: 'rgba(134,236,255,0.55)', cyf: 'rgba(134,236,255,0.14)', amber: '#ffb04d', red: '#ff4d6a', green: '#6cffb0', ink: '#e9fbff', mag: '#ff6cf0' };

export function mono(g, str, x, y, size = 12, color = C.cy, align = 'left', weight = 600) {
  g.font = `${weight} ${size}px ${FONTS.ui}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(str, x, y);
}
// clear + corner brackets + optional title bar + scan lines; returns the usable content rect {x,y,w,h}
export function base(g, W, H, t, { title = '', sub = '', bg = C.bg, accent = C.cy, scan = true } = {}) {
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(40,190,255,0.09)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = accent; g.lineWidth = 1.5; const m = 4, L = Math.min(W, H) * 0.08;
  g.beginPath(); g.moveTo(m, m + L); g.lineTo(m, m); g.lineTo(m + L, m); g.moveTo(W - m - L, m); g.lineTo(W - m, m); g.lineTo(W - m, m + L);
  g.moveTo(m, H - m - L); g.lineTo(m, H - m); g.lineTo(m + L, H - m); g.moveTo(W - m - L, H - m); g.lineTo(W - m, H - m); g.lineTo(W - m, H - m - L); g.stroke();
  let y0 = m + 4;
  if (title) { const s = Math.max(10, H * 0.075); mono(g, title, 14, 10 + s, s, accent, 'left', 700); if (sub) mono(g, sub, W - 14, 10 + s, s * 0.8, C.cyd, 'right'); g.fillStyle = C.cyf; g.fillRect(12, 16 + s, W - 24, 1); y0 = 22 + s; }
  if (scan) { g.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1); const k = (t * 40) % H; g.fillStyle = 'rgba(134,236,255,0.035)'; g.fillRect(0, k, W, 10); }
  return { x: 12, y: y0 + 4, w: W - 24, h: H - y0 - 14 };
}
export function bars(g, x, y, w, h, vals, color = C.cy) {
  const n = vals.length, bw = w / n; g.fillStyle = C.cyf; g.fillRect(x, y, w, h);
  vals.forEach((v, i) => { g.fillStyle = color; const bh = Math.max(1, v * h); g.fillRect(x + i * bw + 1, y + h - bh, bw - 2, bh); });
}
export function line(g, x, y, w, h, fn, color = C.cy, N = 64) {
  g.strokeStyle = C.cyf; g.lineWidth = 1; g.strokeRect(x, y, w, h); g.beginPath();
  for (let i = 0; i <= N; i++) { const u = i / N, v = Math.max(0, Math.min(1, fn(u))); const px = x + u * w, py = y + h - v * h; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.strokeStyle = color; g.lineWidth = 1.6; g.stroke();
}
export function ring(g, cx, cy, r, frac, color = C.cy, lw = 5) {
  g.lineWidth = lw; g.strokeStyle = C.cyf; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = color; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, frac))); g.stroke();
}
export function table(g, x, y, rows, { size = 12, gap = 4, colW = 90, color = C.cy, val = C.ink } = {}) {
  rows.forEach(([k, v, c], i) => { const yy = y + i * (size + gap); mono(g, k, x, yy, size, color); mono(g, String(v), x + colW, yy, size, c || val); });
}
export function radar(g, cx, cy, r, t, blips = 5, seed = 1) {
  g.strokeStyle = C.cyd; g.lineWidth = 1; for (const k of [1, 0.66, 0.33]) { g.beginPath(); g.arc(cx, cy, r * k, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
  const a = (t * 1.6) % (Math.PI * 2); const gr = g.createConicGradient ? g.createConicGradient(a - 1.2, cx, cy) : null;
  if (gr) { gr.addColorStop(0, 'rgba(134,236,255,0)'); gr.addColorStop(0.19, 'rgba(134,236,255,0.35)'); gr.addColorStop(0.2, 'rgba(134,236,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
  const R = mulberry(seed * 977); for (let i = 0; i < blips; i++) { const aa = R() * 6.283, rr = (0.2 + R() * 0.75) * r; g.fillStyle = i % 3 === 0 ? C.amber : C.cy; g.fillRect(cx + Math.cos(aa) * rr - 2, cy + Math.sin(aa) * rr - 2, 4, 4); }
}
export function wave(g, x, y, w, h, t, color = C.cy, f = 3) {
  g.beginPath(); for (let i = 0; i <= 80; i++) { const u = i / 80, v = Math.sin(u * f * 6.283 + t * 3) * Math.sin(u * 3.1 + t) * 0.5 + 0.5; const px = x + u * w, py = y + h - v * h; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.strokeStyle = color; g.lineWidth = 1.5; g.stroke();
}
// Procedural black-hole image (lensed disk, photon ring, doppler-beamed disk band) into the rect (x,y,w,h)
export function blackHole(g, x, y, w, h, t, { tilt = 0.28, label = true } = {}) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#010204'; g.fillRect(x, y, w, h);
  const R0 = mulberry(77); for (let i = 0; i < 160; i++) { const s = R0(); g.fillStyle = `rgba(255,255,255,${0.15 + R0() * 0.6})`; g.fillRect(x + R0() * w, y + R0() * h, s > 0.9 ? 2 : 1, s > 0.9 ? 2 : 1); }
  const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) * 0.2;
  g.globalCompositeOperation = 'lighter';
  // lensed disk image (halo around the shadow)
  for (const k of [-1, 1]) {
    const gr = g.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.55); gr.addColorStop(0, 'rgba(255,210,150,0.95)'); gr.addColorStop(0.25, 'rgba(255,140,50,0.55)'); gr.addColorStop(1, 'rgba(255,80,10,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, R * 1.55, R * 1.55 * (k > 0 ? 1 : 0.86), 0, k > 0 ? Math.PI : 0, k > 0 ? Math.PI * 2 : Math.PI); g.fill();
  }
  g.strokeStyle = 'rgba(255,240,215,0.95)'; g.lineWidth = Math.max(1.2, R * 0.05); g.beginPath(); g.arc(cx, cy, R * 1.02, 0, Math.PI * 2); g.stroke();   // photon ring
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();                                                       // shadow
  // equatorial disk band with doppler beaming (left approaching = brighter/bluer), drifting hot spot
  g.globalCompositeOperation = 'lighter';
  const rx = R * 3.3, ry = R * tilt;
  const gb = g.createLinearGradient(cx - rx, 0, cx + rx, 0); gb.addColorStop(0, 'rgba(255,230,200,0.95)'); gb.addColorStop(0.3, 'rgba(255,170,80,0.85)'); gb.addColorStop(0.5, 'rgba(255,110,30,0.35)'); gb.addColorStop(0.75, 'rgba(210,60,10,0.4)'); gb.addColorStop(1, 'rgba(120,30,5,0.0)');
  g.fillStyle = gb; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); g.ellipse(cx, cy, R * 1.0, ry * 0.2, 0, Math.PI, 0, true); g.fill();     // near side in front
  g.fillStyle = gb; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  const hs = Math.sin(t * 0.9) * rx * 0.8; g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx + hs, cy + ry * 0.35 * Math.sign(Math.cos(t * 0.9)), R * 0.2, ry * 0.18, 0, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over'; g.restore();
  if (label) mono(g, 'EREBUS · LIVE', x + 8, y + h - 8, 11, C.cyd);
}
