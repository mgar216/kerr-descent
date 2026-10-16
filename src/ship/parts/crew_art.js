// Shared 2D art for the crew rooms: ONE atlas canvas (mission poster, child's drawing, menu board, gauges, EVA checklist) → one lit material 'crewArt'.
// kit.crewArt.put(frame, key, [x,y,z], w, h, rot) places a quad showing an atlas rect. Variant-aware (EURYDICE gets its own poster/menu).
import * as THREE from 'three';

const TAU = Math.PI * 2;

export function makeArt(kit) {
  const T = kit.T, eur = kit.eur, UI = T.FONTS.ui, DISP = T.FONTS.disp;
  const AW = 1024, AH = 1024, cv = T.cvs(AW, AH), g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const RECT = { poster: [0, 0, 384, 540], drawing: [388, 0, 384, 288], menu: [388, 292, 384, 288], gP: [776, 0, 128, 128], gO: [776, 132, 128, 128], gT: [776, 264, 128, 128], list: [776, 400, 240, 330], tag: [0, 544, 384, 96], plant: [388, 600, 256, 78], rug: [0, 650, 320, 256], photo: [388, 720, 384, 288], blanket: [776, 740, 240, 240] };
  const uv = {}; for (const k in RECT) { const [x, y, w, h] = RECT[k]; uv[k] = [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH]; }

  const crayon = (pts, col, lw, R) => { for (let pass = 0; pass < 2; pass++) { g.strokeStyle = col; g.globalAlpha = pass ? 0.55 : 0.85; g.lineWidth = lw - pass * 2; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => { const jx = x + (R() - 0.5) * 1.6, jy = y + (R() - 0.5) * 1.6; i ? g.lineTo(jx, jy) : g.moveTo(jx, jy); }); g.stroke(); } g.globalAlpha = 1; };
  const arcPts = (cx, cy, r, a0 = 0, a1 = TAU, n = 28) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(a0 + (a1 - a0) * i / n) * r, cy + Math.sin(a0 + (a1 - a0) * i / n) * r]);

  function poster([x, y, w, h]) {
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip();
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0a1424'); bg.addColorStop(1, eur ? '#1a2d44' : '#14233a'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const R = T.mulberry(77); for (let i = 0; i < 110; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.7})`; const s = R() < 0.1 ? 2 : 1; g.fillRect(R() * w, R() * h, s, s); }
    const cx = w / 2, cy = h * 0.47;
    g.save(); g.translate(cx, cy); g.rotate(-0.26);                                                       // accretion ring behind the patch
    for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(255,${150 + k * 16},${70 + k * 22},${0.62 - k * 0.09})`; g.lineWidth = 11 - k * 1.6; g.beginPath(); g.ellipse(0, 0, 172 + k, 44 + k * 0.6, 0, 0, TAU); g.stroke(); }
    g.restore();
    g.fillStyle = '#0a121d'; g.beginPath(); g.arc(cx, cy, 120, 0, TAU); g.fill();
    g.lineWidth = 10; g.strokeStyle = '#e8742a'; g.beginPath(); g.arc(cx, cy, 120, Math.PI * 0.55, Math.PI * 1.45); g.stroke();
    g.strokeStyle = '#18b8d8'; g.beginPath(); g.arc(cx, cy, 120, -Math.PI * 0.45, Math.PI * 0.45); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 104, 0, TAU); g.stroke();
    g.strokeStyle = '#f2c14e'; g.fillStyle = '#f2c14e'; g.lineWidth = 7; g.lineCap = 'round';           // lyre
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 24, cy + 62); g.bezierCurveTo(cx + s * 74, cy + 30, cx + s * 66, cy - 40, cx + s * 36, cy - 64); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 40, cy - 64); g.lineTo(cx + 40, cy - 64); g.stroke();
    g.lineWidth = 2.5; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * 12, cy - 62); g.lineTo(cx + i * 10, cy + 52); g.stroke(); }
    g.fillRect(cx - 32, cy + 56, 64, 12);
    g.textAlign = 'center'; g.fillStyle = '#f4f1e6'; g.font = `700 52px ${DISP}`; if ('letterSpacing' in g) g.letterSpacing = '8px'; g.fillText(eur ? 'EURYDICE' : 'ORPHEUS', cx + 4, 70);
    g.font = `600 22px ${UI}`; if ('letterSpacing' in g) g.letterSpacing = '5px'; g.fillStyle = '#86ecff'; g.fillText(eur ? 'HX-01 · FIRST DESCENT' : 'HX-02 · EREBUS DESCENT', cx + 3, h - 52);
    g.fillStyle = '#e8742a'; g.fillRect(cx - 70, h - 36, 140, 3); if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.restore();
  }
  function drawing([x, y, w, h]) {
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip();
    g.fillStyle = '#f1e6c8'; g.fillRect(0, 0, w, h); const R = T.mulberry(5);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(120,95,50,${R() * 0.07})`; g.fillRect(R() * w, R() * h, 2 + R() * 3, 2); }
    g.fillStyle = 'rgba(90,70,40,0.10)'; g.fillRect(w / 2 - 1, 0, 2, h);                                    // fold
    for (let r = 4; r < 30; r += 5) crayon(arcPts(72, 62, r, 0, TAU, 20), '#f5c518', 6, R);                // sun
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; crayon([[72 + Math.cos(a) * 36, 62 + Math.sin(a) * 36], [72 + Math.cos(a) * 54, 62 + Math.sin(a) * 54]], '#f5a218', 5, R); }
    for (let k = 0; k < 4; k++) crayon(Array.from({ length: 30 }, (_, i) => [i * 13.4, 236 + k * 9 + Math.sin(i * 0.7 + k) * 5]), k % 2 ? '#3f9e44' : '#58b955', 7, R);   // grass
    const rk = (px, py) => { crayon([[px, py + 48], [px - 17, py + 24], [px - 11, py - 34], [px, py - 58], [px + 11, py - 34], [px + 17, py + 24], [px, py + 48]], '#6c7480', 4, R); for (let i = 0; i < 5; i++) crayon([[px - 12 + i * 3, py - 20 + i * 8], [px + 12 - i * 3, py - 20 + i * 8]], '#e8e8ee', 5, R); crayon(arcPts(px, py - 8, 7, 0, TAU, 10), '#3a7bd5', 4, R); crayon([[px - 17, py + 24], [px - 30, py + 48], [px - 12, py + 40]], '#e64a4a', 5, R); crayon([[px + 17, py + 24], [px + 30, py + 48], [px + 12, py + 40]], '#e64a4a', 5, R); crayon([[px - 7, py + 50], [px, py + 86], [px + 7, py + 50]], '#f28c28', 6, R); crayon([[px - 3, py + 52], [px, py + 72], [px + 3, py + 52]], '#f5c518', 4, R); };
    rk(300, 98);
    const fig = (px, hh, col) => { crayon(arcPts(px, 154 - hh * 0.5, hh * 0.16, 0, TAU, 12), col, 5, R); crayon([[px, 154 - hh * 0.5 + hh * 0.16], [px, 214]], col, 5, R); crayon([[px, 214], [px - hh * 0.2, 238]], col, 5, R); crayon([[px, 214], [px + hh * 0.2, 238]], col, 5, R); };
    fig(120, 88, '#e64a4a'); fig(176, 84, '#3a7bd5'); fig(148, 52, '#8e44ad');
    crayon([[120, 178], [148, 190], [176, 178]], '#8e44ad', 4, R);
    g.fillStyle = '#e64a4a'; g.font = `700 22px "Segoe Print","Comic Sans MS",cursive`; g.textAlign = 'center'; g.fillText('♥', 148, 126);
    g.fillStyle = '#3a3a3a'; g.font = `700 20px "Segoe Print","Comic Sans MS",cursive`; g.fillText('me', 148, 262);
    g.restore();
  }
  function menu([x, y, w, h]) {
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip();
    g.fillStyle = '#1b2228'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; for (let i = 0; i < 40; i++) { g.beginPath(); g.moveTo(0, i * 8); g.lineTo(w, i * 8 + 3); g.stroke(); }
    g.fillStyle = '#e8e6da'; g.textAlign = 'left'; const L = (s, px, py, sz = 24, col = '#e8e6da') => { g.fillStyle = col; g.font = `600 ${sz}px ${UI}`; g.fillText(s, px, py); };
    if (!eur) {
      L('GALLEY  ·  THIS WEEK', 20, 40, 30, '#86ecff'); g.fillStyle = 'rgba(134,236,255,0.4)'; g.fillRect(20, 50, w - 40, 2);
      [['MON', 'lentil dal + rice'], ['TUE', 'lentil dal (again)'], ['WED', 'noodles, fresh basil*'], ['THU', '??? ask LYRA'], ['FRI', 'PIZZA — Mira\'s recipe']].forEach(([d, m], i) => { L(d, 22, 92 + i * 38, 26, '#e8742a'); L(m, 96, 92 + i * 38, 26); });
      L('* basil is Mira\'s. hands off.', 22, 274, 22, '#9fe0a8');
    } else {
      L('FOOD — T.O.', 20, 40, 30, '#ffb04d'); g.fillStyle = 'rgba(255,176,77,0.4)'; g.fillRect(20, 50, w - 40, 2);
      L('63 days for two', 22, 92, 26); L('E says 90 (if I stop', 22, 128, 24, '#c9c6b8'); L('"improving" the rations)', 22, 156, 24, '#c9c6b8');
      L('TEA — RATIONED', 22, 204, 26, '#ffb04d'); L('1 bag / day / person', 22, 236, 22, '#c9c6b8');
      g.strokeStyle = 'rgba(232,230,218,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 262); g.lineTo(250, 258); g.stroke(); L('= still 63', 262, 270, 20, '#e64a4a');
    }
    g.restore();
  }
  function gauge([x, y, s], label, unit, frac, ticks, zone) {
    g.save(); g.translate(x, y); const c = s / 2;
    g.fillStyle = '#080b0f'; g.fillRect(0, 0, s, s); g.fillStyle = '#e9ecef'; g.beginPath(); g.arc(c, c, c - 6, 0, TAU); g.fill();
    g.strokeStyle = '#16191d'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, c - 6, 0, TAU); g.stroke();
    const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
    g.lineWidth = 6; g.strokeStyle = '#2e9e5a'; g.beginPath(); g.arc(c, c, c - 20, a0 + span * zone[0], a0 + span * zone[1]); g.stroke();
    g.strokeStyle = '#111'; g.lineWidth = 2; for (let i = 0; i <= ticks; i++) { const a = a0 + span * i / ticks, r1 = c - 13, r2 = c - (i % 5 === 0 ? 24 : 19); g.beginPath(); g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); g.stroke(); }
    g.fillStyle = '#111'; g.textAlign = 'center'; g.font = `700 11px ${UI}`; g.fillText(label, c, c + 26); g.font = `600 9px ${UI}`; g.fillStyle = '#444'; g.fillText(unit, c, c + 37);
    const a = a0 + span * frac; g.strokeStyle = '#d4301c'; g.lineWidth = 3; g.beginPath(); g.moveTo(c - Math.cos(a) * 8, c - Math.sin(a) * 8); g.lineTo(c + Math.cos(a) * (c - 22), c + Math.sin(a) * (c - 22)); g.stroke();
    g.fillStyle = '#222'; g.beginPath(); g.arc(c, c, 5, 0, TAU); g.fill(); g.restore();
  }
  function list([x, y, w, h]) {
    g.save(); g.translate(x, y); g.fillStyle = '#f0efe6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b3b5a'; g.fillRect(0, 0, w, 40);
    g.fillStyle = '#fff'; g.font = `700 22px ${DISP}`; g.textAlign = 'left'; g.fillText('EVA CHECKLIST', 12, 28);
    const rows = ['SUIT PRESS   4.3 psi', 'PLSS O2      100 %', 'COMMS        LYRA', 'TETHER       2 PTS', 'VISOR SEAL   CLOSED', 'CYCLE AIRLOCK', 'OPEN OUTER HATCH', 'HELMET?  yes, really'];
    g.font = `600 18px ${UI}`; rows.forEach((r, i) => { g.fillStyle = '#1c2630'; g.fillText(r, 14, 72 + i * 34); if (i < 5 && !eur) { g.fillStyle = '#2e9e5a'; g.fillText('✔', w - 30, 72 + i * 34); } g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(12, 80 + i * 34, w - 24, 1); });
    g.restore();
  }
  function tag([x, y, w, h]) {
    g.save(); g.translate(x, y); g.fillStyle = '#e9b500'; g.fillRect(0, 0, w, h); g.fillStyle = '#14120a'; g.fillRect(6, 6, w - 12, h - 12); g.fillStyle = '#e9b500'; g.textAlign = 'center'; g.font = `700 44px ${DISP}`; if ('letterSpacing' in g) g.letterSpacing = '4px'; g.fillText('CYCLE FIRST', w / 2 + 2, h * 0.66); g.restore();
  }
  function plantTag([x, y, w, h]) {
    g.save(); g.translate(x, y); g.fillStyle = '#f4f1e6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2e7d32'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#3f9e44'; for (const [dx, dy, r] of [[26, 40, -0.6], [38, 30, 0.1], [40, 50, 0.6], [24, 22, -1.1]]) { g.save(); g.translate(dx, dy); g.rotate(r); g.beginPath(); g.ellipse(0, 0, 12, 6, 0, 0, TAU); g.fill(); g.restore(); }
    g.strokeStyle = '#2e7d32'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 62); g.lineTo(34, 36); g.stroke();
    g.textAlign = 'left'; g.fillStyle = '#26402a'; g.font = `700 24px "Segoe Print","Comic Sans MS",cursive`; g.fillText("MIRA'S BASIL", 52, 44); g.font = `600 15px ${UI}`; g.fillStyle = '#8a4a2a'; g.fillText('hands off!  ♥', 56, 66);
    g.restore();
  }
  function rug([x, y, w, h]) {
    g.save(); g.translate(x, y); g.fillStyle = '#243752'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8742a'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14); g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h);
    g.strokeStyle = '#e9e1cf'; g.lineWidth = 3; g.strokeRect(22, 22, w - 44, h - 44);
    for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#18b8d8' : '#e9e1cf'; g.fillRect(40 + i * 34, 40, 14, h - 80); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let yy = 0; yy < h; yy += 4) g.fillRect(0, yy, w, 1);
    g.restore();
  }
  function blanket([x, y, w, h]) {
    g.save(); g.translate(x, y); g.fillStyle = '#e06a28'; g.fillRect(0, 0, w, h); const R = T.mulberry(0xb1a7);
    for (let yy = 0; yy < h; yy += 2) for (let xx = 0; xx < w; xx += 2) { const v = 0.82 + ((((xx >> 1) + (yy >> 1)) & 1) * 0.1) + R() * 0.08; g.fillStyle = `rgba(${(255 * v) | 0},${(120 * v) | 0},${(40 * v) | 0},0.55)`; g.fillRect(xx, yy, 2, 2); }
    for (const [a, b, c] of [[0.07, 0.03, '#efe6d0'], [0.115, 0.02, '#18b8d8'], [0.88, 0.02, '#18b8d8'], [0.915, 0.03, '#efe6d0']]) { g.fillStyle = c; g.fillRect(a * w, 0, b * w, h); }
    g.restore();
  }
  const draw = () => {
    g.clearRect(0, 0, AW, AH); poster(RECT.poster); if (!eur) drawing(RECT.drawing); menu(RECT.menu);
    gauge(RECT.gP, 'PRESS', 'kPa', eur ? 0.34 : 0.62, 10, [0.5, 0.72]); gauge(RECT.gO, 'O2', '% vol', eur ? 0.45 : 0.7, 10, [0.62, 0.82]); gauge(RECT.gT, 'TEMP', '°C', eur ? 0.12 : 0.5, 10, [0.4, 0.62]);
    list(RECT.list); tag(RECT.tag); plantTag(RECT.plant); rug(RECT.rug); blanket(RECT.blanket);
    { const [px, py, pw, ph] = RECT.photo; g.drawImage(photoImg, px, py, pw, ph); }
    tex.needsUpdate = true;
  };
  const photoImg = T.photoTex(eur).image;
  draw(); T.onFontsReady(draw);
  kit.defMat('crewArt', { tex: () => ({ map: tex }), uv: 'own', color: 0xffffff, rough: 0.8, metal: 0 });
  return {
    uv, tex,
    put(F, key, p, w, h, rot) { F.quad('crewArt', p, w, h, { uv: uv[key], rot }); },
  };
}
