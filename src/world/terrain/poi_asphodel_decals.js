// ORPHEUS · asphodel POIs — decal atlases + ground-decal textures (canvas, ≤ 512², shared per build).
import * as THREE from 'three';
import { TAU, text, stencil, emblem, atlasRegion, deferredTexture } from './poi_asphodel_parts.js';

/** meadow atlas regions [x, y, w, h] in a 512×512 canvas */
export const AT_MEADOW = {
  word: [0, 0, 512, 84], name: [0, 88, 512, 84], emb: [0, 176, 128, 128], haz: [132, 176, 248, 40], boot: [384, 176, 48, 96], lk: [440, 176, 70, 40],
  cA: [132, 220, 248, 40], cB: [132, 264, 248, 40], cC: [0, 308, 248, 40], cD: [252, 308, 248, 40], tw: [0, 352, 248, 60], tf: [252, 352, 248, 60],
  sgA: [0, 416, 164, 90], sgB: [172, 416, 164, 90], sgC: [344, 416, 164, 90],
};
/** shore atlas regions */
export const AT_SHORE = {
  tags: [0, 0, 512, 64], sign: [0, 68, 256, 128], emb: [260, 68, 128, 128], crack: [392, 68, 120, 120], haz: [0, 200, 248, 40], stakes: [252, 200, 258, 40],
  uav: [0, 244, 248, 60], plate: [252, 244, 258, 60], boot: [0, 308, 48, 96],
};

function pill(g, x, y, w, h, r, fill, stroke, lw = 3) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
function bootPrint(g, [x, y, w, h]) {
  g.save(); g.translate(x + w / 2, y + h / 2); g.fillStyle = 'rgba(28,24,20,0.8)';
  g.beginPath(); g.ellipse(0, -h * 0.22, w * 0.38, h * 0.26, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0, h * 0.28, w * 0.3, h * 0.2, 0, 0, TAU); g.fill();
  g.fillRect(-w * 0.1, -h * 0.05, w * 0.2, h * 0.12);
  g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 5; i++) g.fillRect(-w * 0.4, -h * 0.42 + i * h * 0.17, w * 0.8, 1.6);
  g.restore();
}

export function meadowAtlas(S) {
  const R = AT_MEADOW;
  return deferredTexture(S, 't.atlasMeadow', 512, 512, [
    (g) => {   // wordmark, name plate, emblem, hazard strip, boot print, locker tag
      let [x, y, rw, rh] = R.word; text(g, 'HALCYON  SURVEY', x + rw / 2, y + rh * 0.46, 62, '#15637a', { weight: 800, spacing: 9, maxW: rw - 24 });
      g.fillStyle = '#ee7a2c'; g.fillRect(x + 20, y + rh - 11, rw - 40, 5);
      [x, y, rw, rh] = R.name; pill(g, x + 3, y + 3, rw - 6, rh - 6, 10, '#0e3844', '#e9eeec', 4);
      text(g, 'MEADOW BASE', x + rw / 2, y + rh * 0.40, 46, '#f4f7f5', { weight: 800, spacing: 6, maxW: rw - 40 });
      text(g, 'HALCYON SURVEY · FIELD OUTPOST 02', x + rw / 2, y + rh * 0.78, 17, '#6fd8e4', { weight: 700, spacing: 2, maxW: rw - 40 });
      [x, y, rw, rh] = R.emb; emblem(g, x + rw / 2, y + rh / 2, rw * 0.46);
      [x, y, rw, rh] = R.haz; g.save(); g.beginPath(); g.rect(x, y, rw, rh); g.clip(); g.fillStyle = '#191a1c'; g.fillRect(x, y, rw, rh); g.fillStyle = '#e8a51a';
      for (let i = -2; i < 18; i++) { g.beginPath(); g.moveTo(x + i * 22, y + rh); g.lineTo(x + i * 22 + 11, y + rh); g.lineTo(x + i * 22 + 11 + rh, y); g.lineTo(x + i * 22 + rh, y); g.closePath(); g.fill(); } g.restore();
      bootPrint(g, R.boot);
      [x, y, rw, rh] = R.lk; pill(g, x + 2, y + 2, rw - 4, rh - 4, 5, '#d9dedc', '#2a2f33', 2); text(g, 'EVA-01', x + rw / 2, y + rh / 2, 17, '#1a2328', { weight: 800, spacing: 1, maxW: rw - 12 });
    },
    (g) => {   // container stencils + tank labels
      for (const [k, str, size] of [['cA', 'HSV-0417-A', 36], ['cB', 'MED  SUPPLY', 36], ['cC', 'SAMPLES · 12', 34], ['cD', 'RATIONS · 14D', 34]]) stencil(g, str, R[k][0] + R[k][2] / 2, R[k][1] + R[k][3] / 2, size, '#f1f2ee', { maxW: R[k][2] - 14 });
      let [x, y, rw, rh] = R.tw; pill(g, x + 3, y + 3, rw - 6, rh - 6, 8, '#1a6f9a', '#e9eef0', 3); text(g, 'POTABLE', x + rw / 2, y + rh * 0.33, 24, '#f3f7f8', { weight: 800, spacing: 3, maxW: rw - 24 }); text(g, 'WATER  ·  H₂O', x + rw / 2, y + rh * 0.70, 22, '#cfeaf5', { weight: 700, spacing: 2, maxW: rw - 24 });
      [x, y, rw, rh] = R.tf; pill(g, x + 3, y + 3, rw - 6, rh - 6, 8, '#1b1d20', '#e8a51a', 4); text(g, 'FUEL · H₂/O₂', x + rw / 2, y + rh * 0.33, 24, '#f0c24a', { weight: 800, spacing: 2, maxW: rw - 24 }); text(g, 'NO FLAME  ·  VENT CLEAR', x + rw / 2, y + rh * 0.70, 15, '#e6e6e0', { weight: 700, spacing: 1, maxW: rw - 24 });
    },
    (g) => {   // small signs
      let [x, y, rw, rh] = R.sgA; pill(g, x + 3, y + 3, rw - 6, rh - 6, 8, '#e8a51a', '#17191b', 4); text(g, 'EVA', x + rw / 2, y + rh * 0.36, 38, '#17191b', { weight: 800, spacing: 4, maxW: rw - 24 }); text(g, 'GEAR · CHECK SEALS', x + rw / 2, y + rh * 0.76, 14, '#17191b', { weight: 800, spacing: 1, maxW: rw - 24 });
      [x, y, rw, rh] = R.sgB; pill(g, x + 3, y + 3, rw - 6, rh - 6, 8, '#b3261e', '#f1f1ee', 4); text(g, 'DANGER', x + rw / 2, y + rh * 0.34, 30, '#f6f1ee', { weight: 800, spacing: 3, maxW: rw - 24 }); text(g, '48 V DC · LIVE', x + rw / 2, y + rh * 0.74, 17, '#f6f1ee', { weight: 800, spacing: 1, maxW: rw - 24 });
      [x, y, rw, rh] = R.sgC; pill(g, x + 3, y + 3, rw - 6, rh - 6, 8, '#0e3844', '#e9eeec', 4); text(g, 'WX MAST 01', x + rw / 2, y + rh * 0.34, 28, '#f4f7f5', { weight: 800, spacing: 3, maxW: rw - 24 }); text(g, 'DO NOT CLIMB · LIVE SENSORS', x + rw / 2, y + rh * 0.74, 12, '#6fd8e4', { weight: 700, spacing: 1, maxW: rw - 24 });
    },
  ], { wrap: false });
}

export function shoreAtlas(S) {
  const R = AT_SHORE;
  return deferredTexture(S, 't.atlasShore', 512, 512, [(g) => {
    // sample tags P1..P8
    let [x, y, rw, rh] = R.tags;
    for (let i = 0; i < 8; i++) { const tx = x + i * 64; pill(g, tx + 3, y + 5, 58, rh - 12, 6, '#f2c230', '#2a2412', 3); text(g, `P${i + 1}`, tx + 32, y + rh / 2, 30, '#1c1808', { weight: 800, spacing: 1 }); g.fillStyle = '#2a2412'; g.beginPath(); g.arc(tx + 32, y + 10, 3, 0, TAU); g.fill(); }
    // survey sign
    [x, y, rw, rh] = R.sign; pill(g, x + 3, y + 3, rw - 6, rh - 6, 10, '#0e3844', '#e9eeec', 4);
    text(g, 'TIDAL SURVEY', x + rw / 2, y + rh * 0.24, 26, '#f4f7f5', { weight: 800, spacing: 1.5, maxW: rw - 26 }); text(g, 'STATION  GS-3', x + rw / 2, y + rh * 0.46, 22, '#6fd8e4', { weight: 800, spacing: 2, maxW: rw - 26 });
    text(g, 'DO NOT DISTURB', x + rw / 2, y + rh * 0.68, 18, '#ee7a2c', { weight: 800, spacing: 1.5, maxW: rw - 26 }); text(g, 'SAMPLE PLOTS ARE LOGGED', x + rw / 2, y + rh * 0.86, 13, '#c8dde2', { weight: 700, spacing: 0.5, maxW: rw - 26 });
    [x, y, rw, rh] = R.emb; emblem(g, x + rw / 2, y + rh / 2, rw * 0.46);
    // crack (sensor pod): spidery lines from an impact point
    [x, y, rw, rh] = R.crack; g.save(); g.translate(x + rw * 0.45, y + rh * 0.5); g.strokeStyle = 'rgba(235,245,250,0.85)'; g.lineWidth = 1.6;
    const seed = [0.2, 0.9, 1.6, 2.2, 2.9, 3.6, 4.3, 5.0, 5.7];
    seed.forEach((a, i) => { let px = 0, py = 0, ang = a, len = 20 + (i % 3) * 14; g.beginPath(); g.moveTo(0, 0); for (let k = 0; k < 4; k++) { ang += (k % 2 ? 0.35 : -0.3); px += Math.cos(ang) * len / 3; py += Math.sin(ang) * len / 3; g.lineTo(px, py); } g.stroke(); });
    g.lineWidth = 1; for (let r = 10; r < 36; r += 11) { g.beginPath(); g.arc(0, 0, r, 0.3, 5.9); g.stroke(); } g.restore();
  }, (g) => {
    let [x, y, rw, rh] = R.haz; g.save(); g.beginPath(); g.rect(x, y, rw, rh); g.clip(); g.fillStyle = '#191a1c'; g.fillRect(x, y, rw, rh); g.fillStyle = '#e8a51a';
    for (let i = -2; i < 18; i++) { g.beginPath(); g.moveTo(x + i * 22, y + rh); g.lineTo(x + i * 22 + 11, y + rh); g.lineTo(x + i * 22 + 11 + rh, y); g.lineTo(x + i * 22 + rh, y); g.closePath(); g.fill(); } g.restore();
    // stake paint bands
    [x, y, rw, rh] = R.stakes; for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#f2f2ee' : '#ee7a2c'; g.fillRect(x + i * 28, y, 28, rh); }
    // UAV stencil + plate
    stencil(g, 'UAV-07', R.uav[0] + R.uav[2] / 2, R.uav[1] + R.uav[3] / 2, 46, '#f1f2ee', { maxW: R.uav[2] - 14 });
    [x, y, rw, rh] = R.plate; pill(g, x + 3, y + 3, rw - 6, rh - 6, 8, '#1b1d20', '#e8a51a', 3); text(g, 'SURVEY DRONE · RECOVERY PENDING', x + rw / 2, y + rh * 0.36, 14, '#f0c24a', { weight: 800, spacing: 0.5, maxW: rw - 24 }); text(g, 'KEEP CLEAR · LOGGED', x + rw / 2, y + rh * 0.7, 15, '#e6e6e0', { weight: 700, spacing: 1, maxW: rw - 24 });
    bootPrint(g, R.boot);
  }], { wrap: false });
}

/** vehicle / landing pad disc (512², soft alpha edge) */
export function padTexture(S, label = 'VEHICLE PAD 02') {
  return deferredTexture(S, 't.pad', 512, 512, (g, w, h) => {
    const cx = w / 2, cy = h / 2, R = w / 2 - 3;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#383d40'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    // composite slab seams (radial + rings)
    g.strokeStyle = 'rgba(10,12,14,0.55)'; g.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + 0.15; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.25, cy + Math.sin(a) * R * 0.25); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); }
    g.beginPath(); g.arc(cx, cy, R * 0.52, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, cy, R * 0.74, 0, TAU); g.stroke();
    // speckle
    const rnd = S.kit.rng('padtex');
    for (let i = 0; i < 900; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * R * 0.98; g.fillStyle = rnd() < 0.5 ? 'rgba(210,214,216,0.07)' : 'rgba(0,0,0,0.12)'; g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 2); }
    // hazard ring (segmented)
    for (let i = 0; i < 36; i++) { g.strokeStyle = i % 2 ? '#e8a51a' : '#17191b'; g.lineWidth = R * 0.07; g.beginPath(); g.arc(cx, cy, R * 0.91, i * TAU / 36, (i + 1) * TAU / 36 + 0.003); g.stroke(); }
    g.strokeStyle = '#e8ecea'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, R * 0.82, 0, TAU); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, R * 0.5, 0, TAU); g.stroke();
    // compass ticks
    g.fillStyle = '#e8ecea'; for (let i = 0; i < 8; i++) { g.save(); g.translate(cx, cy); g.rotate(i * TAU / 8); g.fillRect(-4, -R * 0.78, 8, i % 2 ? 14 : 26); g.restore(); }
    g.fillStyle = '#ee7a2c'; g.beginPath(); g.moveTo(cx, cy - R * 0.70); g.lineTo(cx - 14, cy - R * 0.60); g.lineTo(cx + 14, cy - R * 0.60); g.closePath(); g.fill();
    // central H in an emblem circle
    g.fillStyle = '#e8ecea'; g.fillRect(cx - R * 0.17, cy - R * 0.22, R * 0.07, R * 0.44); g.fillRect(cx + R * 0.10, cy - R * 0.22, R * 0.07, R * 0.44); g.fillRect(cx - R * 0.13, cy - R * 0.035, R * 0.26, R * 0.07);
    // arc lettering along the lower ring gap
    g.save(); g.translate(cx, cy); g.font = `800 22px Rajdhani, Bahnschrift, "Segoe UI", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e8ecea';
    const chars = [...label]; const span = 0.5, a0 = Math.PI / 2 + span / 2; // bottom, read left→right
    chars.forEach((ch, i) => { const a = a0 - (i / (chars.length - 1)) * span; g.save(); g.rotate(a - Math.PI / 2); g.translate(0, R * 0.66); g.fillText(ch, 0, 0); g.restore(); });
    g.restore();
    // wear: pale dust drifts + dark scuffs
    for (let i = 0; i < 70; i++) { const a = rnd() * TAU, r = rnd() * R * 0.97; g.fillStyle = rnd() < 0.6 ? 'rgba(170,176,176,0.10)' : 'rgba(8,8,8,0.16)'; g.beginPath(); g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 6 + rnd() * 26, 2 + rnd() * 9, rnd() * TAU, 0, TAU); g.fill(); }
    // soft edge
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(cx, cy, R * 0.93, cx, cy, R); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, w, h);
  }, { wrap: false });
}
export { atlasRegion };
