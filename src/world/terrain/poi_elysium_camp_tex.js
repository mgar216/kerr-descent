// ORPHEUS · Elysium camp textures — ribbed shelter fabric, the notice board (notes, family photo, Mira's drawing), crate stencils,
// solar fabric, instrument screens, boot prints. All canvases ≤ 512², drawn once at build time.
import { HAND, SANS, MONO, TAU, stencilText } from './poi_elysium_lib.js';

// ─────────────────────────────── shelter fabric (ripstop, 8 seamed panels, hem band, dust) ───────────────────────────────
export function fabricTexture(kit) {
  const rnd = kit.rng('camp.fabric');
  return kit.canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#d8d4c8'; g.fillRect(0, 0, w, h);
    const N = 8, pw = w / N;
    for (let k = 0; k < N; k++) { // per-panel tone drift (panels run seam → seam, seams at (k+½)·pw)
      const x0 = (k + 0.5) * pw, t = (rnd() - 0.5) * 24; g.fillStyle = t > 0 ? `rgba(255,255,255,${t / 255 * 0.8})` : `rgba(0,0,0,${-t / 255 * 0.8})`;
      for (const dx of [0, -w]) g.fillRect(x0 + dx, 0, pw, h);
    }
    g.lineWidth = 1; g.strokeStyle = 'rgba(20,20,16,0.045)'; g.beginPath();   // ripstop micro weave
    for (let x = 0; x < w; x += 4) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); }
    for (let y = 0; y < h; y += 4) { g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); }
    g.stroke(); g.strokeStyle = 'rgba(20,20,16,0.09)'; g.beginPath();           // ripstop reinforcement threads
    for (let x = 0; x < w; x += 24) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); }
    for (let y = 0; y < h; y += 24) { g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); }
    g.stroke();
    for (let k = 0; k < N; k++) { // seams: pillow shade, welded band, stitching
      const x = (k + 0.5) * pw, gr = g.createLinearGradient(x - 20, 0, x + 20, 0);
      gr.addColorStop(0, 'rgba(30,28,22,0)'); gr.addColorStop(0.5, 'rgba(30,28,22,0.30)'); gr.addColorStop(1, 'rgba(30,28,22,0)');
      g.fillStyle = gr; g.fillRect(x - 20, 0, 40, h);
      g.fillStyle = '#b0ac9e'; g.fillRect(x - 3, 0, 6, h);
      g.strokeStyle = 'rgba(70,68,58,0.8)'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(x - 7, 0); g.lineTo(x - 7, h); g.moveTo(x + 7, 0); g.lineTo(x + 7, h); g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = 'rgba(48,54,66,0.45)'; g.fillRect(0, h - 36, w, 36);       // reinforced hem
    g.strokeStyle = 'rgba(210,206,190,0.55)'; g.lineWidth = 1.2; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(0, h - 38); g.lineTo(w, h - 38); g.stroke(); g.setLineDash([]);
    g.font = `700 13px ${SANS}`; g.fillStyle = 'rgba(232,228,214,0.82)'; g.textBaseline = 'middle'; g.textAlign = 'left';
    for (let x = 6; x < w; x += 128) g.fillText('EURYDICE · HX-01', x, h - 18);
    const dust = g.createLinearGradient(0, h, 0, h - 110); dust.addColorStop(0, 'rgba(58,66,92,0.5)'); dust.addColorStop(1, 'rgba(58,66,92,0)');
    g.fillStyle = dust; g.fillRect(0, h - 110, w, 110);
    for (let i = 0; i < 36; i++) { const x = rnd() * w, y = rnd() * h, r = 5 + rnd() * 22, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(60,56,46,${0.05 + rnd() * 0.08})`); rg.addColorStop(1, 'rgba(60,56,46,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
    kit.grime(g, w, h, { amount: 0.3, streaks: 8, seed: 5, color: 'rgba(30,30,28,0.15)' });
  }, { aniso: 8 });
}

// ─────────────────────────────── notice board ───────────────────────────────
function pin(g, x, y, c) { g.save(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x + 1.5, y + 2, 4.2, 0, TAU); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(x, y, 4.2, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.arc(x - 1.3, y - 1.4, 1.4, 0, TAU); g.fill(); g.restore(); }

function person(g, cx, baseY, s, o) {
  const R = 11 * s, headY = baseY - 26 * s - 9 * s;
  if (o.long) { g.fillStyle = o.hair; g.beginPath(); g.ellipse(cx, headY + 7 * s, R + 3.5 * s, R + 13 * s, 0, 0, TAU); g.fill(); }
  g.fillStyle = o.top; g.beginPath(); g.ellipse(cx, baseY + 8 * s, 23 * s, 31 * s, 0, Math.PI, TAU); g.lineTo(cx + 23 * s, baseY + 12 * s); g.lineTo(cx - 23 * s, baseY + 12 * s); g.fill();
  g.fillStyle = o.skin; g.fillRect(cx - 3.8 * s, headY + R - 4 * s, 7.6 * s, 10 * s);
  g.beginPath(); g.arc(cx, headY, R, 0, TAU); g.fill();
  g.fillStyle = o.hair; g.beginPath(); g.arc(cx, headY - 0.6 * s, R + 0.9 * s, Math.PI * 1.04, Math.PI * 1.96); g.lineTo(cx + R * 0.7, headY - R * 0.35); g.quadraticCurveTo(cx, headY - R * 0.1, cx - R * 0.7, headY - R * 0.4); g.fill();
  if (o.long) { g.fillRect(cx - R - 3 * s, headY - 1 * s, 4.2 * s, R + 9 * s); g.fillRect(cx + R - 1.2 * s, headY - 1 * s, 4.2 * s, R + 9 * s); }
  if (o.pig) { g.beginPath(); g.arc(cx - R - 3 * s, headY + 3 * s, 4 * s, 0, TAU); g.arc(cx + R + 3 * s, headY + 3 * s, 4 * s, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(40,24,20,0.85)'; g.beginPath(); g.arc(cx - 4 * s, headY + 0.4 * s, 1.1 * s, 0, TAU); g.arc(cx + 4 * s, headY + 0.4 * s, 1.1 * s, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(120,50,40,0.9)'; g.lineWidth = Math.max(1, 1.1 * s); g.beginPath(); g.arc(cx, headY + 2.6 * s, 4.2 * s, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
}

function photo(g, x, y, w, h, rot) {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
  g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  g.fillStyle = '#ece6d6'; g.fillRect(-w / 2, -h / 2, w, h);
  const ix = -w / 2 + 7, iy = -h / 2 + 7, iw = w - 14, ih = h - 27;
  g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
  const sky = g.createLinearGradient(0, iy, 0, iy + ih); sky.addColorStop(0, '#6f9fc8'); sky.addColorStop(0.5, '#eab68a'); sky.addColorStop(1, '#f4d6a4'); g.fillStyle = sky; g.fillRect(ix, iy, iw, ih);
  const sun = g.createRadialGradient(ix + iw * 0.78, iy + ih * 0.42, 0, ix + iw * 0.78, iy + ih * 0.42, ih * 0.55); sun.addColorStop(0, 'rgba(255,240,200,0.85)'); sun.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = sun; g.fillRect(ix, iy, iw, ih);
  g.fillStyle = '#5f7f6b'; g.beginPath(); g.moveTo(ix, iy + ih * 0.66); g.quadraticCurveTo(ix + iw * 0.28, iy + ih * 0.44, ix + iw * 0.52, iy + ih * 0.64); g.quadraticCurveTo(ix + iw * 0.78, iy + ih * 0.8, ix + iw, iy + ih * 0.58); g.lineTo(ix + iw, iy + ih); g.lineTo(ix, iy + ih); g.fill();
  g.fillStyle = '#4a6453'; g.beginPath(); g.moveTo(ix, iy + ih * 0.82); g.quadraticCurveTo(ix + iw * 0.4, iy + ih * 0.7, ix + iw, iy + ih * 0.86); g.lineTo(ix + iw, iy + ih); g.lineTo(ix, iy + ih); g.fill();
  const bY = iy + ih;
  person(g, ix + iw * 0.29, bY, 1.32, { hair: '#2a1b15', long: true, top: '#3c6d59', skin: '#dba87f' });          // Elena
  person(g, ix + iw * 0.71, bY, 1.26, { hair: '#1f1f24', top: '#36507f', skin: '#c99772' });                      // the Commander
  person(g, ix + iw * 0.5, bY + 3, 0.86, { hair: '#4b3121', pig: true, top: '#e8b53b', skin: '#e3b58d' });       // Mira, small, between them
  g.fillStyle = 'rgba(214,190,150,0.16)'; g.fillRect(ix, iy, iw, ih);                                              // faded print
  const vg = g.createRadialGradient(ix + iw / 2, iy + ih / 2, ih * 0.3, ix + iw / 2, iy + ih / 2, iw * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,20,10,0.32)'); g.fillStyle = vg; g.fillRect(ix, iy, iw, ih);
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-w / 2 + 40, -h / 2); g.lineTo(-w / 2 + 62, h / 2); g.stroke();   // crease
  g.fillStyle = '#4a4338'; g.font = `12px ${HAND}`; g.textAlign = 'center'; g.fillText('home', 0, h / 2 - 6);
  pin(g, 0, -h / 2 + 5, '#d6453a');
  g.restore();
}

function childDrawing(g, x, y, w, h, rot) {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
  g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  g.fillStyle = '#f3efe2'; g.fillRect(-w / 2, -h / 2, w, h);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#f2b81f'; g.fillStyle = '#f7d03a'; g.lineWidth = 2.4; g.beginPath(); g.arc(-w / 2 + 26, -h / 2 + 24, 11, 0, TAU); g.fill();   // sun
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; g.beginPath(); g.moveTo(-w / 2 + 26 + Math.cos(a) * 15, -h / 2 + 24 + Math.sin(a) * 15); g.lineTo(-w / 2 + 26 + Math.cos(a) * 22, -h / 2 + 24 + Math.sin(a) * 22); g.stroke(); }
  g.strokeStyle = '#4aa35a'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(-w / 2 + 4, h / 2 - 28); g.bezierCurveTo(-w / 4, h / 2 - 40, 0, h / 2 - 14, w / 2 - 4, h / 2 - 30); g.stroke();   // hill
  g.strokeStyle = '#c93a32'; g.fillStyle = '#e04a3e'; g.lineWidth = 2.2;                                                                             // rocket
  g.beginPath(); g.moveTo(8, -h / 2 + 10); g.quadraticCurveTo(26, -h / 2 + 30, 22, 14); g.lineTo(-6, 14); g.quadraticCurveTo(-10, -h / 2 + 30, 8, -h / 2 + 10); g.fill(); g.stroke();
  g.fillStyle = '#9fd3ec'; g.beginPath(); g.arc(8, -8, 6, 0, TAU); g.fill(); g.strokeStyle = '#2f6f90'; g.lineWidth = 1.6; g.stroke();
  g.fillStyle = '#f08a24'; g.beginPath(); g.moveTo(-4, 14); g.lineTo(8, 34); g.lineTo(20, 14); g.fill();
  g.strokeStyle = '#2f5fb0'; g.lineWidth = 2.4;                                                                                                       // stick family
  const fig = (px, s) => { g.beginPath(); g.arc(px, h / 2 - 46 * s, 5 * s, 0, TAU); g.moveTo(px, h / 2 - 41 * s); g.lineTo(px, h / 2 - 22 * s); g.moveTo(px, h / 2 - 22 * s); g.lineTo(px - 5 * s, h / 2 - 8); g.moveTo(px, h / 2 - 22 * s); g.lineTo(px + 5 * s, h / 2 - 8); g.moveTo(px, h / 2 - 36 * s); g.lineTo(px + 11 * s, h / 2 - 28 * s); g.moveTo(px, h / 2 - 36 * s); g.lineTo(px - 11 * s, h / 2 - 28 * s); g.stroke(); };
  fig(36, 1.0); fig(58, 1.0); fig(47, 0.62);
  g.fillStyle = '#d6335a'; g.font = `700 11px ${HAND}`; g.textAlign = 'center'; g.fillText("MUM'S ROCKET", 5, h / 2 - 5);
  pin(g, 0, -h / 2 + 5, '#3a86d6');
  g.restore();
}

function note(g, x, y, w, h, rot, bg, lines, o = {}) {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
  g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  g.fillStyle = bg; g.fillRect(-w / 2, -h / 2, w, h);
  const lh = o.lh || 16;
  if (o.lined) { g.strokeStyle = 'rgba(70,110,170,0.38)'; g.lineWidth = 1; for (let yy = -h / 2 + 24; yy < h / 2; yy += lh) { g.beginPath(); g.moveTo(-w / 2, yy); g.lineTo(w / 2, yy); g.stroke(); } g.strokeStyle = 'rgba(200,70,70,0.4)'; g.beginPath(); g.moveTo(-w / 2 + 17, -h / 2); g.lineTo(-w / 2 + 17, h / 2); g.stroke(); }
  g.fillStyle = o.ink || '#27304f'; g.font = `${o.size || 13}px ${HAND}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  lines.forEach((ln, i) => g.fillText(ln, -w / 2 + (o.lined ? 22 : 9), -h / 2 + 22 + i * lh));
  pin(g, 0, -h / 2 + 6, o.pin || '#d6453a');
  g.restore();
}

function galaxy(g, rnd, x, y, w, h, rot) {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
  g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  g.fillStyle = '#0f1932'; g.fillRect(-w / 2, -h / 2, w, h);
  for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`; g.fillRect(-w / 2 + rnd() * w, -h / 2 + rnd() * h, 1, 1); }
  for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 170; i++) {
    const t = i / 170, a = arm * Math.PI + t * 6.1, r = 5 + t * 44, px = Math.cos(a) * r, py = -6 + Math.sin(a) * r * 0.6;
    g.fillStyle = `rgba(${150 + t * 70},${190 + t * 40},255,${0.6 - t * 0.38})`; g.beginPath(); g.arc(px + (rnd() - 0.5) * 7 * t, py + (rnd() - 0.5) * 5 * t, 1 + (1 - t) * 1.4, 0, TAU); g.fill();
  }
  const cg = g.createRadialGradient(0, -6, 0, 0, -6, 15); cg.addColorStop(0, 'rgba(255,240,210,0.95)'); cg.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = cg; g.fillRect(-15, -21, 30, 30);
  g.fillStyle = '#d6e6ff'; g.font = `12px ${HAND}`; g.textAlign = 'center'; g.fillText('the big one', 0, h / 2 - 8);
  pin(g, 0, -h / 2 + 5, '#e8c13a');
  g.restore();
}

/** returns { tex, photoUV } — photoUV is the inner picture rect (u0,v0,u1,v1) for the little framed copy on the table */
export function boardTexture(kit) {
  const rnd = kit.rng('camp.board'); let photoUV = null;
  const tex = kit.canvasTexture(512, 384, (g, w, h) => {
    g.fillStyle = '#8c6b46'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2800; i++) { const t = rnd(); g.fillStyle = t < 0.33 ? 'rgba(60,40,20,0.28)' : t < 0.66 ? 'rgba(196,154,104,0.26)' : 'rgba(112,82,52,0.3)'; const s = 1 + rnd() * 2.6; g.fillRect(rnd() * w, rnd() * h, s, s * (0.6 + rnd() * 0.8)); }
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,10,0,0.35)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    // crew card
    g.save(); g.translate(266, 56); g.rotate(0.03); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-49, -31, 104, 68); g.fillStyle = '#f0ede4'; g.fillRect(-52, -34, 104, 68);
    g.fillStyle = '#e3732b'; g.fillRect(-52, -34, 104, 6); g.fillStyle = '#25282c'; g.font = `700 11px ${SANS}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText('EURYDICE  HX-01', -45, -15); g.font = `10px ${SANS}`; g.fillText('CDR   E. VARIS', -45, 2); g.fillText('FE    T. OYELARAN', -45, 16); g.fillText('LANDER  LANTERN', -45, 29); pin(g, 0, -31, '#2fb5c9'); g.restore();
    photo(g, 28, 26, 168, 132, -0.05);
    childDrawing(g, 338, 18, 150, 112, 0.045);
    note(g, 214, 108, 112, 100, -0.035, '#f4dd6a', ["Soup's on the", 'stove, Tomas.', "Don't let it boil", 'over AGAIN.', '            - E'], { size: 13, pin: '#d6453a' });
    note(g, 28, 178, 150, 132, 0.02, '#f2f1ec', ['LANTERN: all green', 'air    ok', 'power  ok', 'heat   ok', 'sky: still up'], { lined: true, size: 13, ink: '#2b3a66' });
    galaxy(g, rnd, 196, 222, 130, 118, -0.025);
    note(g, 346, 148, 140, 94, 0.03, '#b9dcf2', ['Garden sensors,', 'back by dark.', '(There is no dark.)', '            - T'], { size: 13, ink: '#1d3550', pin: '#e8c13a' });
    note(g, 340, 256, 152, 112, -0.02, '#f1efe6', ['TO DO', '[x] land (done!)', '[x] tea', '[x] hang lamps', '[ ] name the crystals', '[ ] messages home'], { lined: true, size: 12, lh: 15, ink: '#33405e', pin: '#3a86d6' });
    g.save(); g.translate(104, 346); g.rotate(-0.015); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-77, -29, 164, 60); g.fillStyle = '#c9a877'; g.fillRect(-80, -32, 164, 60);   // kraft card
    g.strokeStyle = 'rgba(30,26,22,0.85)'; g.lineWidth = 2; g.lineCap = 'round';                                                                                                    // tally marks
    for (let row = 0; row < 2; row++) for (let grp = 0; grp < 4; grp++) { const bx = -68 + grp * 38, by = -22 + row * 25; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(bx + i * 6, by); g.lineTo(bx + i * 6 + 0.6, by + 14); g.stroke(); } g.beginPath(); g.moveTo(bx - 3, by + 12); g.lineTo(bx + 21, by + 2); g.stroke(); }
    pin(g, 0, -29, '#d6453a'); g.restore();
    photoUV = [(28 + 7 + 14) / w, 1 - (26 + 132 - 21 + 2) / h, (28 + 168 - 7 - 14) / w, 1 - (26 + 7 + 12) / h];
  }, { wrap: false, aniso: 8 });
  return { tex, photoUV };
}

// ─────────────────────────────── crates: 2×2 atlas (front / side / lid / base) ───────────────────────────────
export function crateTexture(kit) {
  const rnd = kit.rng('camp.crate');
  return kit.canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#cfd4d8'; g.fillRect(0, 0, w, h);
    // cells are 256×256; the wide faces (crate w:h ≈ 1.6:1) are authored in a 256×160 box and stretched ×1.6 vertically so glyphs stay undistorted
    const cell = (cx, cy, vs, fn) => { g.save(); g.translate(cx, cy); g.beginPath(); g.rect(0, 0, 256, 256); g.clip(); g.scale(1, vs); fn(256, 256 / vs); g.restore(); };
    const ink = '#1f2428', frameCell = (W, H) => { g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 7; g.strokeRect(9, 9, W - 18, H - 18); g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 2; g.strokeRect(16, 16, W - 32, H - 32); };
    cell(0, 0, 1.6, (W, H) => { // front: stencilled name + hazard strip
      frameCell(W, H);
      stencilText(g, 'EURYDICE', 128, 46, 38, ink); stencilText(g, 'HX-01', 128, 88, 50, ink);
      g.fillStyle = ink; g.fillRect(36, 116, 184, 2); g.font = `700 11px ${SANS}`; g.textAlign = 'center'; g.fillText('CREW SUPPLY  ·  SEAL ON CLOSE', 128, 130);
      g.fillStyle = '#e3732b'; g.fillRect(24, 138, 208, 9); g.fillStyle = ink; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(24 + i * 16, 147); g.lineTo(32 + i * 16, 138); g.lineTo(40 + i * 16, 138); g.lineTo(32 + i * 16, 147); g.fill(); }
    });
    cell(256, 0, 1, (W, H) => { // end face: label plate + barcode
      frameCell(W, H); g.fillStyle = '#eceae2'; g.fillRect(34, 46, 188, 128); g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(34, 46, 188, 128);
      g.fillStyle = ink; g.textAlign = 'left'; g.font = `700 15px ${SANS}`; g.fillText('CONTENTS', 44, 68); g.font = `13px ${SANS}`;
      ['FOOD / WATER', 'LOT  07 / 12', 'KEEP DRY', 'THIS SIDE UP'].forEach((t, i) => g.fillText(t, 44, 90 + i * 18));
      for (let i = 0; i < 38; i++) { g.fillRect(44 + i * 3.6, 150, 1 + (i * 7 % 3), 18); }
      stencilText(g, 'HX-01', 128, 214, 30, ink);
    });
    cell(0, 256, 1.6, (W, H) => { // lid: moulded ribs, latch recesses
      frameCell(W, H); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.strokeRect(46, 32 + i * 28, 164, 14); }
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(22, 62, 28, 34); g.fillRect(206, 62, 28, 34); stencilText(g, 'HX-01', 128, 136, 22, ink);
    });
    cell(256, 256, 1, (W, H) => { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, W, H); frameCell(W, H); });
    for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * h, r = 3 + rnd() * 16, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(40,40,40,${0.05 + rnd() * 0.1})`); rg.addColorStop(1, 'rgba(40,40,40,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
    kit.grime(g, w, h, { amount: 0.4, streaks: 14, seed: 11, color: 'rgba(24,24,24,0.2)' });
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; for (let i = 0; i < 60; i++) { const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 24, y + (rnd() - 0.5) * 24); g.stroke(); }   // scratches
  }, { aniso: 8 });
}

// ─────────────────────────────── solar fabric ───────────────────────────────
export function solarTexture(kit) {
  return kit.canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#12203d'; g.fillRect(0, 0, w, h);
    const cols = 6, rows = 9, cw = (w - 12) / cols, ch = (h - 12) / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = 6 + i * cw + 1.5, y = 6 + j * ch + 1.5, gr = g.createLinearGradient(x, y, x + cw, y + ch);
      gr.addColorStop(0, '#2a4a86'); gr.addColorStop(0.5, '#1b3363'); gr.addColorStop(1, '#223d73'); g.fillStyle = gr; g.fillRect(x, y, cw - 3, ch - 3);
      g.fillStyle = 'rgba(170,186,214,0.7)'; g.fillRect(x + (cw - 3) / 3, y, 1, ch - 3); g.fillRect(x + 2 * (cw - 3) / 3, y, 1, ch - 3);
      g.fillStyle = 'rgba(190,204,228,0.8)'; g.fillRect(x, y + ch * 0.45, cw - 3, 1.2);
    }
    g.strokeStyle = 'rgba(214,220,232,0.7)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    const sh = g.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(160,200,255,0.16)'); sh.addColorStop(0.5, 'rgba(160,200,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.18)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
    kit.grime(g, w, h, { amount: 0.25, streaks: 6, seed: 4, color: 'rgba(180,190,210,0.12)' });
  }, { aniso: 8 });
}

// ─────────────────────────────── instrument screens (tablet + handheld) ───────────────────────────────
export const INSTR_UV = { tablet: [0, 18 / 128, 176 / 256, 1], hand: [184 / 256, 38 / 128, 1, 1] };
export function instrumentTexture(kit) {
  return kit.canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#06141f'; g.fillRect(0, 0, 176, 110);
    g.strokeStyle = 'rgba(80,200,230,0.18)'; g.lineWidth = 1; for (let x = 0; x <= 176; x += 22) { g.beginPath(); g.moveTo(x + 0.5, 14); g.lineTo(x + 0.5, 110); g.stroke(); } for (let y = 30; y <= 110; y += 20) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(176, y + 0.5); g.stroke(); }
    g.fillStyle = 'rgba(120,230,255,0.95)'; g.font = `700 10px ${MONO}`; g.textBaseline = 'middle'; g.fillText('XTAL-04  RES 440.2 Hz', 6, 8);
    const trace = (col, a, f, ph, y0) => { g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); for (let x = 0; x <= 176; x += 2) { const y = y0 + Math.sin(x * f + ph) * a + Math.sin(x * f * 2.7 + ph * 2) * a * 0.35; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
    trace('rgba(80,230,255,0.95)', 12, 0.11, 0.3, 52); trace('rgba(180,140,255,0.9)', 8, 0.17, 1.4, 80); trace('rgba(255,190,110,0.85)', 5, 0.29, 2.2, 98);
    g.fillStyle = '#031006'; g.fillRect(184, 0, 72, 90); g.fillStyle = 'rgba(120,255,160,0.95)'; g.font = `700 30px ${MONO}`; g.textAlign = 'center'; g.fillText('41.7', 220, 38); g.font = `700 11px ${MONO}`; g.fillText('uT  FIELD', 220, 66);
    g.fillStyle = 'rgba(120,255,160,0.5)'; g.fillRect(192, 78, 56, 3);
  }, { wrap: false, aniso: 4 });
}

// ─────────────────────────────── boot print (alpha mask, toe up) ───────────────────────────────
export function printTexture(kit) {
  return kit.canvasTexture(64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(52, 6, 58, 30, 55, 60); g.bezierCurveTo(54, 74, 50, 84, 48, 92); g.lineTo(46, 118); g.bezierCurveTo(44, 126, 20, 126, 18, 118); g.lineTo(16, 92); g.bezierCurveTo(12, 84, 8, 70, 9, 58); g.bezierCurveTo(8, 28, 14, 6, 32, 6); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (let i = 0; i < 7; i++) { g.fillRect(14, 14 + i * 9, 36, 2.6); }
    for (let i = 0; i < 4; i++) { g.fillRect(20, 84 + i * 9, 24, 2.4); }
    g.fillRect(14, 74, 36, 3);
  }, { wrap: false, aniso: 4 });
}
