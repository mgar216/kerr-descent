// Procedural CanvasTextures for the ship (albedo + normal + roughness/metal), cached per page.
import * as THREE from 'three';

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

const UI_FONT = "'Rajdhani','Share Tech Mono','Arial Narrow',Arial,sans-serif";
const DISP_FONT = "'Orbitron','Rajdhani','Segoe UI',Arial,sans-serif";
export const FONTS = { ui: UI_FONT, disp: DISP_FONT };

// textures whose content depends on web fonts get redrawn once fonts load
const redraws = [];
let fontsHooked = false;
function hookFonts() {
  if (fontsHooked || typeof document === 'undefined' || !document.fonts) return;
  fontsHooked = true;
  const go = () => { for (const f of redraws) { try { f(); } catch (e) { /* ignore */ } } };
  Promise.all([document.fonts.load("700 40px 'Orbitron'"), document.fonts.load("600 20px 'Rajdhani'")]).then(go).catch(() => {});
}
export function onFontsReady(fn) { redraws.push(fn); hookFonts(); }

function tex(canvas, { srgb = true, repeat = true, aniso = 8, flipY = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.flipY = flipY;
  return t;
}

// height canvas → normal map canvas (tileable)
function heightToNormal(hc, strength = 2.0) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cvs(w, h), og = out.getContext('2d'), img = og.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w, yc = y * w;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w, xr = (x + 1) % w;
      const dx = (src[(yc + xr) * 4] - src[(yc + xl) * 4]) / 255 * strength;
      const dy = (src[(yd + x) * 4] - src[(yu + x) * 4]) / 255 * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = 1 / Math.hypot(nx, ny, nz); nx *= l; ny *= l; nz *= l;
      const o = (yc + x) * 4;
      d[o] = (nx * 0.5 + 0.5) * 255; d[o + 1] = (ny * 0.5 + 0.5) * 255; d[o + 2] = (nz * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

// Three aligned layers: albedo (a), height (h), orm-ish (r: G = roughness, B = metalness). All drawing calls wrap around the tile.
class Layers {
  constructor(w, h, base = {}) {
    this.w = w; this.h = h;
    this.a = cvs(w, h); this.h_ = cvs(w, h); this.r = cvs(w, h);
    this.ga = this.a.getContext('2d'); this.gh = this.h_.getContext('2d'); this.gr = this.r.getContext('2d');
    const { a = '#888', hgt = 128, rough = 140, metal = 10 } = base;
    this.ga.fillStyle = a; this.ga.fillRect(0, 0, w, h);
    this.gh.fillStyle = `rgb(${hgt},${hgt},${hgt})`; this.gh.fillRect(0, 0, w, h);
    this.gr.fillStyle = `rgb(255,${rough},${metal})`; this.gr.fillRect(0, 0, w, h);
  }
  _each(fnA, fnH, fnR) { fnA(this.ga); fnH(this.gh); fnR(this.gr); }
  // wrapped rect fill on any subset of layers
  rect(x, y, w, h, a, hv, rv, mv) {
    const W = this.w, H = this.h;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const X = x + ox * W, Y = y + oy * H;
      if (X + w < 0 || Y + h < 0 || X > W || Y > H) continue;
      if (a != null) { this.ga.fillStyle = a; this.ga.fillRect(X, Y, w, h); }
      if (hv != null) { this.gh.fillStyle = `rgb(${hv},${hv},${hv})`; this.gh.fillRect(X, Y, w, h); }
      if (rv != null || mv != null) {
        // read-modify not available; paint explicit orm with provided or default values
        this.gr.fillStyle = `rgb(255,${rv == null ? 140 : rv},${mv == null ? 10 : mv})`; this.gr.fillRect(X, Y, w, h);
      }
    }
  }
  circle(cx, cy, r, a, hv, rv, mv) {
    const W = this.w, H = this.h;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const X = cx + ox * W, Y = cy + oy * H;
      if (X + r < 0 || Y + r < 0 || X - r > W || Y - r > H) continue;
      const path = (g) => { g.beginPath(); g.arc(X, Y, r, 0, Math.PI * 2); };
      if (a != null) { this.ga.fillStyle = a; path(this.ga); this.ga.fill(); }
      if (hv != null) { this.gh.fillStyle = `rgb(${hv},${hv},${hv})`; path(this.gh); this.gh.fill(); }
      if (rv != null || mv != null) { this.gr.fillStyle = `rgb(255,${rv == null ? 140 : rv},${mv == null ? 10 : mv})`; path(this.gr); this.gr.fill(); }
    }
  }
  text(str, x, y, font, a, hv) {
    for (const [g, c] of [[this.ga, a], [this.gh, hv != null ? `rgb(${hv},${hv},${hv})` : null]]) {
      if (c == null) continue;
      g.save(); g.font = font; g.fillStyle = c; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(str, x, y); g.restore();
    }
  }
  alphaLine(x1, y1, x2, y2, lw, rgba) { this.ga.strokeStyle = rgba; this.ga.lineWidth = lw; this.ga.beginPath(); this.ga.moveTo(x1, y1); this.ga.lineTo(x2, y2); this.ga.stroke(); }
  textures({ normalStrength = 2.0, aniso = 8 } = {}) {
    return {
      map: tex(this.a, { aniso }),
      normalMap: tex(heightToNormal(this.h_, normalStrength), { srgb: false, aniso }),
      ormMap: tex(this.r, { srgb: false, aniso }),
    };
  }
}

const cache = new Map();
function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

// ───────────────────────────── hull (exterior) ─────────────────────────────
// 4 m × 4 m tile at 256 px/m. White ceramic panels, dark seams, rivets, hatches, vents, stencils, soot.
export function hullPanels() {
  return cached('hullPanels', () => {
    const S = 1024, R = mulberry(0x5a17), L = new Layers(S, S, { a: '#e6e8ec', hgt: 128, rough: 138, metal: 12 });
    const rows = []; let y = 0;
    while (y < S) { let h = Math.round(118 + R() * 96); if (S - (y + h) < 110) h = S - y; rows.push([y, h]); y += h; }
    const tones = ['#e9ebef', '#e4e6ea', '#eceef1', '#dfe2e7', '#e7e8ea', '#ebe9e6'];
    const details = [];
    rows.forEach(([ry, rh], ri) => {
      const off = Math.round(R() * 300);
      const ws = []; let sum = 0;
      while (sum < S) { let w = Math.round(210 + R() * 220); if (S - (sum + w) < 190) w = S - sum; ws.push(w); sum += w; }
      let x = off;
      ws.forEach((w) => {
        const tone = R() < 0.07 ? '#cfd3d9' : R() < 0.05 ? '#f0ebe2' : tones[(R() * tones.length) | 0];
        L.rect(x, ry, w, rh, tone, 128, 134 + R() * 22, 12);
        // subtle top-lit gradient + inner edge shading
        const g = L.ga.createLinearGradient(0, ry, 0, ry + rh); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(60,66,80,0.07)');
        L.ga.fillStyle = g; for (let ox = -1; ox <= 1; ox++) { const X = x + ox * S; if (X + w < 0 || X > S) continue; L.ga.fillRect(X, ry, w, rh); }
        details.push({ x, y: ry, w, h: rh, ri });
        x += w;
      });
    });
    // seams + bevel lips
    for (const d of details) {
      L.rect(d.x - 1, d.y, 3, d.h, '#23262c', 52, 205, 150);        // vertical groove
      L.rect(d.x + 2, d.y + 1, 1, d.h - 2, 'rgba(255,255,255,0.6)', 152, null, null);
      L.rect(d.x, d.y - 1, d.w, 3, '#23262c', 52, 205, 150);        // horizontal groove
      L.rect(d.x + 1, d.y + 2, d.w - 2, 1, 'rgba(255,255,255,0.55)', 152, null, null);
    }
    // rivets
    for (const d of details) {
      if (R() < 0.35) continue;
      const step = 22 + ((R() * 8) | 0), m = 8;
      for (let px = d.x + m; px < d.x + d.w - m; px += step) for (const py of [d.y + m, d.y + d.h - m]) { L.circle(px, py, 1.7, '#9c9fa8', 170); L.circle(px - 0.5, py - 0.5, 0.8, '#ffffff', 190); }
      for (let py = d.y + m + step; py < d.y + d.h - m; py += step) for (const px of [d.x + m, d.x + d.w - m]) { L.circle(px, py, 1.7, '#9c9fa8', 170); L.circle(px - 0.5, py - 0.5, 0.8, '#ffffff', 190); }
    }
    // hatches, vents, stencils, hazard labels
    const stencils = ['NO STEP', 'HX-02', 'ACCESS', 'COOLANT', 'RCS', 'AFT', 'PUSH', 'DANGER', 'GND', 'N2 FILL'];
    let n = 0;
    for (const d of details) {
      if (d.w < 230 || d.h < 120) continue;
      const roll = R();
      const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
      if (roll < 0.14) { // access hatch
        const hw = Math.min(d.w - 46, 150 + R() * 60), hh = Math.min(d.h - 40, 70 + R() * 30);
        L.rect(cx - hw / 2, cy - hh / 2, hw, hh, '#d9dce2', 96, 120, 80);
        L.rect(cx - hw / 2, cy - hh / 2, hw, 2, '#2a2d33', 60, 210, 150); L.rect(cx - hw / 2, cy + hh / 2 - 2, hw, 2, '#2a2d33', 60, 210, 150);
        L.rect(cx - hw / 2, cy - hh / 2, 2, hh, '#2a2d33', 60, 210, 150); L.rect(cx + hw / 2 - 2, cy - hh / 2, 2, hh, '#2a2d33', 60, 210, 150);
        L.rect(cx - 14, cy - 3, 28, 6, '#555a63', 170, 90, 200);
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.circle(cx + dx * (hw / 2 - 8), cy + dy * (hh / 2 - 8), 2.3, '#8a8d95', 175);
      } else if (roll < 0.24) { // vent louvers
        const vw = Math.min(d.w - 50, 110), vh = Math.min(d.h - 44, 64);
        L.rect(cx - vw / 2, cy - vh / 2, vw, vh, '#44484f', 70, 170, 140);
        for (let k = 0; k < 7; k++) L.rect(cx - vw / 2 + 6, cy - vh / 2 + 6 + k * ((vh - 12) / 7), vw - 12, 3, '#14161a', 30, 220, 100);
      } else if (roll < 0.40) { // stencil text
        const t = stencils[(R() * stencils.length) | 0];
        L.text(t, cx, cy, `700 ${12 + ((R() * 4) | 0)}px ${UI_FONT}`, 'rgba(50,56,66,0.82)', 120);
      } else if (roll < 0.46) { // hazard patch
        const s = 26;
        L.rect(cx - s, cy - s * 0.6, s * 2, s * 1.2, '#e8b800', 122, 150, 20);
        for (let k = -3; k < 6; k++) { L.ga.fillStyle = '#16181c'; L.ga.save(); L.ga.beginPath(); L.ga.rect(cx - s, cy - s * 0.6, s * 2, s * 1.2); L.ga.clip(); L.ga.beginPath(); L.ga.moveTo(cx - s + k * 14, cy + s * 0.6); L.ga.lineTo(cx - s + k * 14 + 7, cy + s * 0.6); L.ga.lineTo(cx - s + k * 14 + 7 + s * 1.2, cy - s * 0.6); L.ga.lineTo(cx - s + k * 14 + s * 1.2, cy - s * 0.6); L.ga.fill(); L.ga.restore(); }
      }
      n++;
    }
    // soot / thermal streaks along the length (u axis = canvas x)
    for (let i = 0; i < 70; i++) {
      const sx = R() * S, sy = R() * S, len = 90 + R() * 380, a = 0.035 + R() * 0.06;
      for (let ox = -1; ox <= 1; ox++) { L.ga.strokeStyle = `rgba(52,50,58,${a})`; L.ga.lineWidth = 1 + R() * 2.5; L.ga.beginPath(); L.ga.moveTo(sx + ox * S, sy); L.ga.lineTo(sx + ox * S + len, sy + (R() - 0.5) * 4); L.ga.stroke(); }
    }
    // fine grain
    const id = L.ga.getImageData(0, 0, S, S), dd = id.data;
    for (let i = 0; i < dd.length; i += 4) { const g = (R() - 0.5) * 7; dd[i] += g; dd[i + 1] += g; dd[i + 2] += g; }
    L.ga.putImageData(id, 0, 0);
    return L.textures({ normalStrength: 2.6 });
  });
}

// Dark carbon-composite trim (512 px = 2 m): twill weave with panel seams
export function carbonTrim() {
  return cached('carbon', () => {
    const S = 512, R = mulberry(0xcafe), L = new Layers(S, S, { a: '#1c1f25', hgt: 128, rough: 120, metal: 90 });
    for (let y = 0; y < S; y += 6) for (let x = 0; x < S; x += 6) {
      const k = ((x / 6 + y / 6) % 4) < 2;
      L.rect(x, y, 6, 6, k ? '#23272e' : '#181b20', k ? 136 : 120);
    }
    for (let x = 0; x < S; x += 256) { L.rect(x - 1, 0, 3, S, '#0b0c0f', 40, 200, 120); }
    for (let y = 0; y < S; y += 170) { L.rect(0, y - 1, S, 3, '#0b0c0f', 40, 200, 120); }
    for (let i = 0; i < 30; i++) { const px = R() * S, py = R() * S; L.circle(px, py, 1.5, '#555a63', 170, 90, 180); }
    return L.textures({ normalStrength: 1.6 });
  });
}

// Brushed/greebled metal (raw titanium, structure): 512 px = 1 m
export function brushedMetal() {
  return cached('brushed', () => {
    const S = 512, R = mulberry(0xb00b), L = new Layers(S, S, { a: '#8a8f98', hgt: 128, rough: 110, metal: 200 });
    for (let i = 0; i < 1400; i++) { const x = R() * S, y = R() * S, l = 30 + R() * 140, v = 110 + R() * 70; L.alphaLine(x, y, x + l, y, 1, `rgba(${v},${v + 4},${v + 10},0.18)`); }
    for (let i = 0; i < 18; i++) { const x = R() * S, y = R() * S; L.circle(x, y, 2.2, '#6c7078', 160, 100, 220); L.circle(x - 0.6, y - 0.6, 0.9, '#c8ccd4', 180); }
    L.rect(0, 0, S, 2, '#585c64', 70, 140, 220); L.rect(0, S - 2, S, 2, '#585c64', 70, 140, 220);
    return L.textures({ normalStrength: 1.2 });
  });
}

// ───────────────────────────── interior ─────────────────────────────
// Wall panels: warm light grey, 2 m tile (256 px/m).
export function wallPanels() {
  return cached('wall', () => {
    const S = 512, R = mulberry(0x7a11), L = new Layers(S, S, { a: '#c9cace', hgt: 128, rough: 150, metal: 10 });
    const cols = [0, 128, 256, 384];
    for (const cx of cols) for (const [cy, ch] of [[0, 256], [256, 256]]) {
      const tone = R() < 0.18 ? '#bcbec3' : R() < 0.1 ? '#d3d1cc' : '#cacbcf';
      L.rect(cx, cy, 128, ch, tone, 128, 148, 10);
      L.rect(cx - 1, cy, 2, ch, '#2f3238', 60, 200, 80); L.rect(cx + 2, cy, 1, ch, 'rgba(255,255,255,0.45)', 150);
      L.rect(cx, cy - 1, 128, 2, '#2f3238', 60, 200, 80); L.rect(cx, cy + 2, 128, 1, 'rgba(255,255,255,0.45)', 150);
      for (const [dx, dy] of [[8, 8], [120, 8], [8, ch - 8], [120, ch - 8]]) { L.circle(cx + dx, cy + dy, 2.1, '#8d9096', 170); L.circle(cx + dx - 0.5, cy + dy - 0.5, 0.9, '#fff', 185); }
      const r = R();
      if (r < 0.16) { // vent
        L.rect(cx + 24, cy + ch / 2 - 22, 80, 44, '#53565e', 70, 170, 120);
        for (let k = 0; k < 6; k++) L.rect(cx + 30, cy + ch / 2 - 17 + k * 7, 68, 3, '#17191d', 28, 230, 90);
      } else if (r < 0.28) { // service plate with 4 screws
        L.rect(cx + 28, cy + ch / 2 - 18, 72, 36, '#b2b5bb', 108, 120, 120);
        L.rect(cx + 28, cy + ch / 2 - 18, 72, 2, '#3a3d43', 60); L.rect(cx + 28, cy + ch / 2 + 16, 72, 2, '#3a3d43', 60);
      } else if (r < 0.36) { // orange stripe accent
        L.rect(cx, cy + ch / 2 - 3, 128, 6, '#e8742a', 132, 130, 20);
      }
    }
    return L.textures({ normalStrength: 1.8 });
  });
}

// Deck plating: dark steel with diamond tread, 1 m tile (512 px)
export function deckPlate() {
  return cached('deck', () => {
    const S = 512, R = mulberry(0xdec4), L = new Layers(S, S, { a: '#30343b', hgt: 128, rough: 120, metal: 150 });
    // diamond tread
    for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) {
      const o = ((y / 16) & 1) * 8, k = ((x / 16) + (y / 16)) & 1;
      L.rect(x + o % 16, y, 10, 3, k ? '#3d424a' : '#2b2f35', k ? 190 : 80, 100, 190);
    }
    for (const p of [0, 256]) { L.rect(p - 2, 0, 4, S, '#15171b', 40, 200, 100); L.rect(0, p - 2, S, 4, '#15171b', 40, 200, 100); }
    for (const p of [0, 256]) for (const q of [0, 256]) for (const [dx, dy] of [[10, 10], [-10, 10], [10, -10], [-10, -10]]) L.circle((p + dx + S) % S, (q + dy + S) % S, 2.4, '#707680', 190, 100, 220);
    // wear lane
    for (let i = 0; i < 40; i++) { const x = R() * S, y = R() * S; L.alphaLine(x, y, x + 30 + R() * 90, y + (R() - 0.5) * 6, 2, 'rgba(210,214,222,0.05)'); }
    return L.textures({ normalStrength: 2.4 });
  });
}

// Grating (engineering catwalk): 1 m tile; alpha cut-out holes; emissive heat glow underneath
export function grating() {
  return cached('grate', () => {
    const S = 256, c = cvs(S, S), g = c.getContext('2d'), hc = cvs(S, S), hg = hc.getContext('2d');
    g.clearRect(0, 0, S, S);
    hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
    const cell = 16, bar = 4;
    g.fillStyle = '#4a4f58'; g.fillRect(0, 0, S, S);
    // holes → transparent
    g.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < S; y += cell) for (let x = 0; x < S; x += cell) g.fillRect(x + bar / 2, y + bar / 2, cell - bar, cell - bar);
    g.globalCompositeOperation = 'source-over';
    // bar tops lighter
    g.fillStyle = 'rgba(255,255,255,0.16)';
    for (let x = 0; x < S; x += cell) g.fillRect(x, 0, 1, S);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < S; y += cell) g.fillRect(0, y, S, 1);
    for (let y = 0; y < S; y += cell) for (let x = 0; x < S; x += cell) { hg.fillStyle = '#c0c0c0'; hg.fillRect(x, y, cell, bar / 2); hg.fillRect(x, y, bar / 2, cell); }
    const ec = cvs(S, S), eg = ec.getContext('2d');                       // emissive (heat from below, seen through holes only matters w/ alpha)
    eg.fillStyle = '#000'; eg.fillRect(0, 0, S, S);
    return { map: tex(c), normalMap: tex(heightToNormal(hc, 1.6), { srgb: false }) };
  });
}

// Ceiling acoustic panels: 2 m tile
export function ceilingPanels() {
  return cached('ceil', () => {
    const S = 512, R = mulberry(0xce11), L = new Layers(S, S, { a: '#d3d5d8', hgt: 128, rough: 165, metal: 6 });
    for (let y = 0; y < S; y += 128) for (let x = 0; x < S; x += 128) {
      L.rect(x - 1, y, 2, 128, '#555a62', 70, 200, 60); L.rect(x, y - 1, 128, 2, '#555a62', 70, 200, 60);
      for (let k = 0; k < 90; k++) L.circle(x + 8 + R() * 112, y + 8 + R() * 112, 1.2, '#9aa0a8', 110);
    }
    return L.textures({ normalStrength: 1.2 });
  });
}

// Fabric (seat cushions, bunk): charcoal-blue weave, 0.5 m tile
export function fabric() {
  return cached('fabric', () => {
    const S = 256, R = mulberry(0xfab1), L = new Layers(S, S, { a: '#303846', hgt: 128, rough: 200, metal: 0 });
    for (let y = 0; y < S; y += 3) for (let x = 0; x < S; x += 3) { const k = ((x / 3) + (y / 3)) & 1; L.rect(x, y, 3, 3, k ? '#353e4d' : '#2b3340', k ? 140 : 116, 205, 0); }
    return L.textures({ normalStrength: 1.4 });
  });
}

// Wood (galley table, shelves, desk): warm oak, 1 m tile
export function wood() {
  return cached('wood', () => {
    const S = 512, R = mulberry(0x600d), L = new Layers(S, S, { a: '#a87a4c', hgt: 128, rough: 120, metal: 0 });
    for (let y = 0; y < S; y += 2) {
      const v = (Math.sin(y * 0.08) * 0.5 + Math.sin(y * 0.31 + 2) * 0.3 + R() * 0.25), k = 150 + v * 30;
      L.rect(0, y, S, 2, `rgb(${k | 0},${(k * 0.72) | 0},${(k * 0.46) | 0})`, 128 + v * 12, 110 + v * 12, 0);
    }
    for (let i = 0; i < 40; i++) { const x = R() * S, y = R() * S; L.alphaLine(x, y, x + 20 + R() * 120, y + (R() - 0.5) * 3, 1, 'rgba(60,35,15,0.35)'); }
    for (let p = 0; p < S; p += 170) L.rect(0, p, S, 2, '#3a2412', 80, 160, 0);
    return L.textures({ normalStrength: 1.1 });
  });
}

// Hazard stripe tile (yellow/black 45°), 0.5 m
export function hazard() {
  return cached('hazard', () => {
    const S = 256, c = cvs(S, S), g = c.getContext('2d');
    g.fillStyle = '#e9b500'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#141518';
    for (let k = -S; k < S * 2; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 32, 0); g.lineTo(k + 32 + S, S); g.lineTo(k + S, S); g.closePath(); g.fill(); }
    return { map: tex(c) };
  });
}

// Radiator panel texture: dark composite with coolant-channel lines; emissive map = hot orange glow along channels
export function radiator() {
  return cached('radiator', () => {
    const W = 512, H = 512, R = mulberry(0x4ad1);
    const c = cvs(W, H), g = c.getContext('2d'), e = cvs(W, H), eg = e.getContext('2d'), hc = cvs(W, H), hg = hc.getContext('2d');
    g.fillStyle = '#23262c'; g.fillRect(0, 0, W, H); eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H); hg.fillStyle = '#808080'; hg.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 32) {
      g.fillStyle = '#2b2f37'; g.fillRect(x + 2, 0, 28, H);
      g.fillStyle = '#12141a'; g.fillRect(x, 0, 2, H);
      eg.fillStyle = '#ff7a2a'; eg.fillRect(x + 12, 0, 8, H);
      hg.fillStyle = '#a0a0a0'; hg.fillRect(x + 2, 0, 28, H); hg.fillStyle = '#404040'; hg.fillRect(x, 0, 2, H);
    }
    for (let y = 0; y < H; y += 128) { g.fillStyle = '#0c0d10'; g.fillRect(0, y, W, 3); eg.fillStyle = '#000'; eg.fillRect(0, y, W, 3); }
    for (let i = 0; i < 40; i++) { const x = R() * W, y = R() * H; g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y, 6 + R() * 30, 2); }
    return { map: tex(c), emissiveMap: tex(e), normalMap: tex(heightToNormal(hc, 1.4), { srgb: false }) };
  });
}

// Frost / crystal overlay (alpha), used on glass + decals for EURYDICE
export function frost() {
  return cached('frost', () => {
    const S = 1024, R = mulberry(0xf205), c = cvs(S, S), g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    const edge = (x, y) => Math.min(x, y, S - x, S - y) / (S * 0.5);                   // 0 at the border → 1 at the centre
    // fine feathery crystals growing in from the border (dense, short)
    const branch = (x, y, ang, len, w, depth) => {
      if (depth > 3 || len < 5) return;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      g.strokeStyle = `rgba(222,240,255,${Math.max(0.12, 0.62 - depth * 0.14)})`; g.lineWidth = w; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      const n = 2 + ((R() * 2) | 0);
      for (let i = 0; i < n; i++) { const t = 0.3 + R() * 0.65; branch(x + (x2 - x) * t, y + (y2 - y) * t, ang + (R() - 0.5) * 2.0, len * (0.5 + R() * 0.25), w * 0.72, depth + 1); }
    };
    for (let i = 0; i < 520; i++) { const side = (R() * 4) | 0, t = R() * S; const [x, y, a] = side === 0 ? [t, 0, Math.PI / 2] : side === 1 ? [t, S, -Math.PI / 2] : side === 2 ? [0, t, 0] : [S, t, Math.PI]; branch(x, y, a + (R() - 0.5) * 1.0, 28 + R() * 70, 1.7, 0); }
    // scattered ice feathers biased toward the edges
    for (let i = 0; i < 2600; i++) {
      const x = R() * S, y = R() * S, e = edge(x, y); if (R() > Math.pow(1 - e, 1.6) * 0.9) continue;
      const n = 4 + ((R() * 4) | 0), a0 = R() * 6.283, l = 4 + R() * 11 * (1.2 - e);
      g.strokeStyle = `rgba(228,244,255,${0.18 + R() * 0.4})`; g.lineWidth = 1;
      for (let k = 0; k < n; k++) { const a = a0 + k * 6.283 / n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    }
    // rim haze + fine speckle
    // patchy condensation across the whole pane (low-frequency), then rim haze
    for (let i = 0; i < 70; i++) {
      const x = R() * S, y = R() * S, rr = 40 + R() * 120, gb = g.createRadialGradient(x, y, 0, x, y, rr);
      gb.addColorStop(0, `rgba(214,234,252,${0.05 + R() * 0.14})`); gb.addColorStop(1, 'rgba(214,234,252,0)'); g.fillStyle = gb; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S * 0.74);
    gr.addColorStop(0, 'rgba(205,228,248,0.04)'); gr.addColorStop(1, 'rgba(214,234,252,0.52)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 5000; i++) { const x = R() * S, y = R() * S; if (R() > 1.1 - edge(x, y)) { g.fillStyle = `rgba(238,248,255,${R() * 0.3})`; g.fillRect(x, y, 1 + R() * 1.6, 1 + R() * 1.6); } }
    return { map: tex(c, { repeat: false }) };
  });
}

// Soft glow sprite (radial gradient), for nav lights / strobes / plume cores
export function glowSprite() {
  return cached('glow', () => {
    const S = 128, c = cvs(S, S), g = c.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    return tex(c, { repeat: false });
  });
}

// Plume gradient (u along the beam: 0 = nozzle, 1 = tail; v = across)
export function plumeTex() {
  return cached('plume', () => {
    const W = 256, H = 64, c = cvs(W, H), g = c.getContext('2d');
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / (W - 1), v = Math.abs(y / (H - 1) - 0.5) * 2;
      const core = Math.exp(-v * v * 5.0) * Math.exp(-u * 2.2), halo = Math.exp(-v * v * 1.6) * Math.exp(-u * 3.4) * 0.55;
      const a = Math.min(1, core + halo), o = (y * W + x) * 4;
      img.data[o] = 200 + 55 * core; img.data[o + 1] = 190 + 50 * core; img.data[o + 2] = 255; img.data[o + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
    return tex(c, { repeat: false });
  });
}

// ───────────────────────────── decals ─────────────────────────────
function lyrePatch(g, cx, cy, r, ink = '#f2f4f8', ring = '#e8742a', field = '#101c33') {
  g.save();
  g.fillStyle = field; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = ring; g.lineWidth = r * 0.07; g.beginPath(); g.arc(cx, cy, r * 0.93, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = ink; g.lineWidth = r * 0.035; g.beginPath(); g.arc(cx, cy, r * 0.82, 0, Math.PI * 2); g.stroke();
  // lyre: two curved arms, crossbar, strings
  g.strokeStyle = ink; g.lineWidth = r * 0.075; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - r * 0.32, cy - r * 0.46); g.bezierCurveTo(cx - r * 0.62, cy - r * 0.05, cx - r * 0.44, cy + r * 0.38, cx - r * 0.1, cy + r * 0.5); g.stroke();
  g.beginPath(); g.moveTo(cx + r * 0.32, cy - r * 0.46); g.bezierCurveTo(cx + r * 0.62, cy - r * 0.05, cx + r * 0.44, cy + r * 0.38, cx + r * 0.1, cy + r * 0.5); g.stroke();
  g.beginPath(); g.moveTo(cx - r * 0.34, cy - r * 0.44); g.lineTo(cx + r * 0.34, cy - r * 0.44); g.stroke();
  g.lineWidth = r * 0.03;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * r * 0.12, cy - r * 0.42); g.lineTo(cx + i * r * 0.07, cy + r * 0.52); g.stroke(); }
  g.fillStyle = ring; g.beginPath(); g.arc(cx, cy + r * 0.56, r * 0.07, 0, Math.PI * 2); g.fill();
  // event-horizon arc motif
  g.strokeStyle = ring; g.lineWidth = r * 0.04; g.beginPath(); g.arc(cx, cy + r * 0.05, r * 0.68, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
  g.restore();
}

// Name decal: ORPHEUS / EURYDICE + registry + mission patch. Returns { canvas, tex, aspect }. mirror=true flips nothing (decal quads are oriented per flank).
export function nameDecal(name = 'ORPHEUS', reg = 'HX-02', eur = false) {
  const W = 2048, H = 512, c = cvs(W, H), g = c.getContext('2d');
  const t = tex(c, { repeat: false, aniso: 8 });
  const draw = () => {
    g.clearRect(0, 0, W, H);
    // lettering
    g.save(); g.fillStyle = eur ? '#2a2e36' : '#1b2028'; g.textBaseline = 'middle'; g.textAlign = 'left';
    let fs = 250; const maxW = W - 600;
    for (; fs > 90; fs -= 6) { g.font = `900 ${fs}px ${DISP_FONT}`; if ('letterSpacing' in g) g.letterSpacing = `${Math.round(fs * 0.09)}px`; if (g.measureText(name).width <= maxW) break; }
    g.fillText(name, 40, 190);
    g.font = `700 112px ${DISP_FONT}`; if ('letterSpacing' in g) g.letterSpacing = '18px'; g.fillStyle = '#e8742a';
    g.fillText(reg, 48, 408);
    g.fillStyle = '#1b2028'; g.font = `600 52px ${UI_FONT}`; if ('letterSpacing' in g) g.letterSpacing = '12px';
    g.fillText(eur ? 'SURVEY VESSEL · EXPLORATION DIRECTORATE' : 'DEEP SURVEY · HALCYON EXPLORATION DIRECTORATE', 400, 410);
    g.restore();
    g.fillStyle = '#e8742a'; g.fillRect(40, 338, 240, 12); g.fillStyle = '#18b8d8'; g.fillRect(292, 338, 120, 12);
    lyrePatch(g, W - 250, H / 2, 230);
    if (eur) { // wear: scratched paint
      const R = mulberry(0xe0e0); g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + R() * 0.5})`; g.fillRect(R() * W, R() * H, 2 + R() * 26, 1 + R() * 3); }
      g.globalCompositeOperation = 'source-over';
    }
    t.needsUpdate = true;
  };
  draw(); onFontsReady(draw);
  return { canvas: c, tex: t, aspect: W / H };
}

// Mission plaque (flight deck): brushed plate with engraved text. 1024×512
export function plaqueTex(eur = false) {
  const W = 1024, H = 512, c = cvs(W, H), g = c.getContext('2d'), t = tex(c, { repeat: false });
  const draw = () => {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#3a3f48'); gr.addColorStop(0.5, '#4b515c'); gr.addColorStop(1, '#2f343c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 240; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + (i % 5) * 0.008})`; g.fillRect(0, i * 2.2, W, 1); }
    g.strokeStyle = '#c8a24a'; g.lineWidth = 6; g.strokeRect(18, 18, W - 36, H - 36);
    g.strokeStyle = 'rgba(200,162,74,0.5)'; g.lineWidth = 2; g.strokeRect(30, 30, W - 60, H - 60);
    lyrePatch(g, 170, H / 2, 112);
    g.fillStyle = '#e8d7a8'; g.textAlign = 'left'; g.textBaseline = 'middle';
    const fit = (str, x, y, size, weight, family, maxW, spacing) => { let s = size; for (; s > 14; s -= 2) { g.font = `${weight} ${s}px ${family}`; if ('letterSpacing' in g) g.letterSpacing = `${Math.round(s * spacing)}px`; if (g.measureText(str).width <= maxW) break; } g.fillText(str, x, y); };
    const maxW = W - 330 - 48;
    fit(eur ? 'EURYDICE  HX-01' : 'ORPHEUS  HX-02', 330, 150, 64, 700, DISP_FONT, maxW, 0.12);
    g.fillStyle = '#d4c595';
    fit(eur ? 'FIRST CREWED ERGOSPHERE SURVEY' : 'FIRST CREWED DESCENT THROUGH A ROTATING HORIZON', 330, 232, 34, 500, UI_FONT, maxW, 0.08);
    fit(eur ? 'COMMANDER E. VARIS · ENG. T. OYELARAN' : 'HALCYON STATION · EREBUS · 46 M', 330, 286, 34, 500, UI_FONT, maxW, 0.08);
    g.fillStyle = '#b9a574';
    fit(eur ? '“Where the light is.”' : '“Don’t look back. Look forward.”', 330, 372, 32, 'italic 500', UI_FONT, maxW, 0.06);
    t.needsUpdate = true;
  };
  draw(); onFontsReady(draw);
  return t;
}

// Photo frame content: warm composition with 3 silhouettes (adult, adult, small child) — no real faces
export function photoTex(eur = false) {
  const W = 512, H = 384, c = cvs(W, H), g = c.getContext('2d'), t = tex(c, { repeat: false });
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, eur ? '#6d8fb4' : '#f2b46c'); sky.addColorStop(0.55, eur ? '#a8bfd4' : '#f7d79a'); sky.addColorStop(1, eur ? '#35506a' : '#5f7f46');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // sun / low hills / water line
  g.fillStyle = eur ? 'rgba(255,255,255,0.35)' : 'rgba(255,240,200,0.9)'; g.beginPath(); g.arc(W * 0.72, H * 0.34, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = eur ? '#27405a' : '#486a3c'; g.beginPath(); g.moveTo(0, H * 0.62); g.quadraticCurveTo(W * 0.3, H * 0.5, W * 0.55, H * 0.62); g.quadraticCurveTo(W * 0.8, H * 0.52, W, H * 0.6); g.lineTo(W, H); g.lineTo(0, H); g.fill();
  g.fillStyle = eur ? '#1e3248' : '#37542f'; g.fillRect(0, H * 0.78, W, H * 0.22);
  // silhouettes: tall adult, adult, small child holding a hand
  const fig = (x, h, w, col) => {
    g.fillStyle = col;
    g.beginPath(); g.ellipse(x, H * 0.9 - h, w * 0.32, w * 0.36, 0, 0, Math.PI * 2); g.fill();                    // head
    g.beginPath(); g.moveTo(x - w * 0.5, H * 0.9); g.quadraticCurveTo(x - w * 0.62, H * 0.9 - h * 0.7, x - w * 0.22, H * 0.9 - h * 0.82);
    g.lineTo(x + w * 0.22, H * 0.9 - h * 0.82); g.quadraticCurveTo(x + w * 0.62, H * 0.9 - h * 0.7, x + w * 0.5, H * 0.9); g.closePath(); g.fill();
  };
  const dark = eur ? '#0f1b2a' : '#2a1d17';
  fig(W * 0.34, 178, 92, dark); fig(W * 0.52, 168, 86, dark); fig(W * 0.435, 92, 50, dark);
  g.strokeStyle = dark; g.lineWidth = 9; g.beginPath(); g.moveTo(W * 0.39, H * 0.9 - 110); g.lineTo(W * 0.43, H * 0.9 - 70); g.moveTo(W * 0.48, H * 0.9 - 104); g.lineTo(W * 0.45, H * 0.9 - 70); g.stroke();
  // film grain + vignette + slight fade
  const R = mulberry(0x9f07); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? 0 : 255},${R() < 0.5 ? 0 : 255},${R() < 0.5 ? 0 : 255},0.05)`; g.fillRect(R() * W, R() * H, 1.5, 1.5); }
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,10,0,0.45)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  if (eur) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, W, H); }
  t.needsUpdate = true;
  return t;
}

// Label sheet helper: draws a small plate. Used by sign atlas.
export function drawPlate(g, w, h, text, { fg = '#e9fbff', bg = '#14202c', border = '#86ecff', font = null, accent = null } = {}) {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = border; g.lineWidth = Math.max(2, h * 0.05); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
  if (accent) { g.fillStyle = accent; g.fillRect(0, 0, h * 0.18, h); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const size = Math.floor(h * 0.52); g.font = font || `700 ${size}px ${DISP_FONT}`; if ('letterSpacing' in g) g.letterSpacing = `${Math.floor(h * 0.06)}px`;
  let s = size; while (g.measureText(text).width > w * 0.86 && s > 8) { s -= 2; g.font = `700 ${s}px ${DISP_FONT}`; }
  g.fillText(text, w / 2 + (accent ? h * 0.08 : 0), h / 2 + h * 0.03);
}
