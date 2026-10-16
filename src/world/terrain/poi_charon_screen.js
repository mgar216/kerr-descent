// ORPHEUS · Sentinel Observatory — the weatherproof viewing-kiosk screen: Ilse Varga's long exposure of the horizon.
// 512×288 CanvasTexture, redrawn at ≈2 Hz by tick(t). A static layer (stars, black horizon, frame text) is painted once;
// each redraw adds sensor noise, the barely-visible red smeared ghost (EURYDICE, frozen at the horizon) breathing slowly and the live counters.
const W = 512, H = 288;
const HORIZON = 236;                       // mean horizon line (px)
const GX = 334, GY = 212;                  // ghost position

export function makeGhostScreen(kit) {
  const rng = kit.mulberry32(0x5e17e11);
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  paintStatic(bg.getContext('2d'), rng);

  const tex = kit.canvasTexture(W, H, (g) => g.drawImage(bg, 0, 0), { wrap: false, aniso: 4 });
  const g = tex.image.getContext('2d');
  const nr = kit.mulberry32(0x77aa31);
  let last = -1e9;

  function redraw(t) {
    g.globalCompositeOperation = 'source-over';
    g.drawImage(bg, 0, 0);

    // ghost: dim red smear (horizontal integration smear + faint vertical streak), breathing slowly
    const breath = 0.5 + 0.5 * Math.sin(t * 0.7), k = 0.55 + 0.45 * breath;
    const jx = (nr() - 0.5) * 0.8, jy = (nr() - 0.5) * 0.5;
    g.save(); g.translate(GX + jx, GY + jy);
    g.globalCompositeOperation = 'lighter';
    g.save(); g.scale(1, 0.22);
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, 34); gr.addColorStop(0, `rgba(255,70,52,${0.34 * k})`); gr.addColorStop(0.35, `rgba(200,36,30,${0.15 * k})`); gr.addColorStop(1, 'rgba(120,10,10,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill(); g.restore();
    g.save(); g.scale(0.16, 1);
    gr = g.createRadialGradient(0, 0, 0, 0, 0, 22); gr.addColorStop(0, `rgba(255,60,44,${0.20 * k})`); gr.addColorStop(1, 'rgba(120,10,10,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.restore();
    gr = g.createRadialGradient(0, 0, 0, 0, 0, 4.2); gr.addColorStop(0, `rgba(255,130,110,${0.62 * k})`); gr.addColorStop(1, 'rgba(255,50,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 4.2, 0, 7); g.fill();
    g.restore();

    // sensor noise: sparse hot pixels + faint read-out sweep
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) { const a = 0.05 + nr() * 0.28; g.fillStyle = `rgba(${150 + nr() * 100 | 0},${170 + nr() * 60 | 0},255,${a})`; g.fillRect(nr() * W | 0, nr() * (HORIZON - 4) | 0, 1, 1); }
    const sy = ((t * 24) % (H + 60)) - 30, sg = g.createLinearGradient(0, sy - 26, 0, sy + 26);
    sg.addColorStop(0, 'rgba(120,170,220,0)'); sg.addColorStop(0.5, 'rgba(120,170,220,0.045)'); sg.addColorStop(1, 'rgba(120,170,220,0)');
    g.fillStyle = sg; g.fillRect(0, sy - 26, W, 52);

    // live text
    g.globalCompositeOperation = 'source-over';
    g.font = '11px Consolas, "Lucida Console", monospace'; g.textBaseline = 'alphabetic';
    const s = Math.floor(t), hh = String(Math.floor(s / 3600) % 100).padStart(2, '0'), mm = String(Math.floor(s / 60) % 60).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
    g.fillStyle = 'rgba(150,196,220,0.62)'; g.textAlign = 'right';
    g.fillText(`+${hh}:${mm}:${ss}`, W - 16, H - 14);
    g.fillStyle = `rgba(150,196,220,${0.40 + 0.2 * nr()})`;
    g.fillText(`SNR ${(3.0 + 0.3 * Math.sin(t * 0.41) + 0.08 * nr()).toFixed(2)}`, W - 16, 24);
    g.textAlign = 'left';
    g.fillStyle = `rgba(255,120,104,${0.30 + 0.34 * breath})`;
    g.fillText('HX-01', GX + 30, GY - 14);

    // glass: soft vignette
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,6,0.5)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
  redraw(0); tex.needsUpdate = true;
  return {
    texture: tex,
    /** call every frame; redraws at most every 0.5 s. returns true when the texture was refreshed */
    tick(t) { if (t - last < 0.5) return false; last = t; redraw(t); tex.needsUpdate = true; return true; },
  };
}

function paintStatic(b, rng) {
  const gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#01020a'); gr.addColorStop(0.65, '#040716'); gr.addColorStop(1, '#0b1024');
  b.fillStyle = gr; b.fillRect(0, 0, W, H);

  // faint galactic band
  b.save(); b.translate(W * 0.30, H * 0.30); b.rotate(-0.42);
  const band = b.createLinearGradient(0, -H * 0.2, 0, H * 0.2); band.addColorStop(0, 'rgba(110,130,200,0)'); band.addColorStop(0.5, 'rgba(110,130,200,0.075)'); band.addColorStop(1, 'rgba(110,130,200,0)');
  b.fillStyle = band; b.fillRect(-W, -H * 0.2, W * 2, H * 0.4);
  for (let i = 0; i < 1100; i++) { const x = (rng() - 0.5) * W * 1.5, y = (rng() - 0.5) * H * 0.36 * (0.3 + rng()), a = 0.10 + rng() * 0.2; b.fillStyle = `rgba(170,190,255,${a * 0.5})`; b.fillRect(x, y, 1, 1); }
  b.restore();

  // stars: many faint, a few bright with diffraction spikes
  for (let i = 0; i < 460; i++) {
    const x = rng() * W, y = rng() * (HORIZON - 12), m = rng(), a = m < 0.8 ? 0.14 + m * 0.3 : 0.55 + (m - 0.8) * 1.5, s = m < 0.9 ? 1 : m < 0.985 ? 1.6 : 2.2;
    const warm = rng() > 0.62; b.fillStyle = warm ? `rgba(255,224,190,${a})` : `rgba(200,220,255,${a})`;
    if (m < 0.9) b.fillRect(x, y, 1, 1); else { b.beginPath(); b.arc(x, y, s * 0.55, 0, 7); b.fill(); }
    if (m > 0.985) { b.strokeStyle = `rgba(210,225,255,${a * 0.28})`; b.lineWidth = 0.6; b.beginPath(); b.moveTo(x - 7, y); b.lineTo(x + 7, y); b.moveTo(x, y - 7); b.lineTo(x, y + 7); b.stroke(); }
  }

  // black crater-rim horizon with a razor rim-light
  const prof = []; let ph = rng() * 6;
  for (let x = 0; x <= W; x += 4) { const rim = Math.max(0, 1 - Math.abs(x - 118) / 54) * 7 + Math.max(0, 1 - Math.abs(x - 420) / 70) * 5; prof.push([x, HORIZON - rim + Math.sin(x * 0.045 + ph) * 3.2 + Math.sin(x * 0.19 + ph * 2) * 1.2 + (rng() - 0.5) * 1.6]); }
  b.beginPath(); b.moveTo(0, H); for (const p of prof) b.lineTo(p[0], p[1]); b.lineTo(W, H); b.closePath(); b.fillStyle = '#000'; b.fill();
  b.beginPath(); for (let i = 0; i < prof.length; i++) { const p = prof[i]; i ? b.lineTo(p[0], p[1]) : b.moveTo(p[0], p[1]); } b.strokeStyle = 'rgba(120,150,210,0.16)'; b.lineWidth = 0.8; b.stroke();

  // frame: corner brackets + target ticks around the ghost + fixed text
  b.strokeStyle = 'rgba(130,180,210,0.34)'; b.lineWidth = 1;
  for (const [cx, cy, sx, sy] of [[12, 12, 1, 1], [W - 12, 12, -1, 1], [12, H - 12, 1, -1], [W - 12, H - 12, -1, -1]]) { b.beginPath(); b.moveTo(cx, cy + sy * 14); b.lineTo(cx, cy); b.lineTo(cx + sx * 14, cy); b.stroke(); }
  b.strokeStyle = 'rgba(255,110,96,0.22)';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { b.beginPath(); b.moveTo(GX + dx * 24, GY + dy * 24); b.lineTo(GX + dx * 32, GY + dy * 32); b.stroke(); }
  b.font = '11px Consolas, "Lucida Console", monospace'; b.textBaseline = 'alphabetic'; b.textAlign = 'left';
  try { b.letterSpacing = '0.6px'; } catch { /* optional */ }
  b.fillStyle = 'rgba(150,196,220,0.62)';
  b.fillText('SENTINEL-1 · LONG EXPOSURE', 18, 24);
  b.fillText('EURYDICE · HX-01 · INTEGRATION 11y', 18, H - 14);
  b.fillStyle = 'rgba(150,196,220,0.36)'; b.fillText('XRB-J1840 · HORIZON', 18, H - 30);
  try { b.letterSpacing = '0px'; } catch { /* optional */ }
}
