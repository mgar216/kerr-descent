// Shared helpers for the cargo + engineering parts (all state lives on the kit instance — no module singletons):
//   frame(kit, origin, yaw[, sink])  local-coordinate builder (box/cyl/sph/torus/lathe/tube/pipe/valve/…), stencils, signs, colliders
//   defMats(kit)                     shared custom materials (paints, crates, copper, net, e-track …)
//   stencils(kit)                    paint-stencil atlas (alpha-cut quads merged into one draw call)
//   floorDecal(kit, o)               one lit transparent canvas plane for floor paint
//   dynSink() / basicMat() / modeK() helpers for dynamic (emissive) merged meshes that follow kit.state.mode
import * as THREE from 'three';
import { bevelBoxArrays, extrudePoly, MeshBuilder, placement } from './builder.js';
import { FONTS, cvs, mulberry, onFontsReady } from './textures.js';

const V3 = THREE.Vector3, Qn = THREE.Quaternion, V2 = THREE.Vector2;
const Y_AXIS = new V3(0, 1, 0);
const AXQ = { y: new Qn(), x: new Qn().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), z: new Qn().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)) };
const TORQ = { z: new Qn(), y: new Qn().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), x: new Qn().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)) };
const AXI = { x: 0, y: 1, z: 2 };

// ───────────────────────── local frame builder ─────────────────────────
// Local axes: +x/+y/+z rotated by `yaw` about world Y (P maps local → world). Euler opts rx/ry/rz use order YXZ (yaw first).
export function frame(kit, origin = [0, 0, 0], yaw = 0, sink = null) {
  const out = sink || kit;
  const [ox, oy, oz] = origin, c = Math.cos(yaw), s = Math.sin(yaw);
  const qf = new Qn().setFromAxisAngle(Y_AXIS, yaw), eu = new THREE.Euler(0, 0, 0, 'YXZ');
  const P = (x, y, z) => [ox + x * c + z * s, oy + y, oz - x * s + z * c];
  const Qo = (o, ax) => { eu.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); const q = qf.clone().multiply(new Qn().setFromEuler(eu)); return ax ? q.multiply(ax) : q; };
  const f = { P, Qo, kit, yaw, origin, out };
  const pp = (p) => P(p[0], p[1], p[2]);

  f.sub = (p, dyaw = 0, snk = out) => frame(kit, P(p[0], p[1], p[2]), yaw + dyaw, snk === kit ? null : snk);
  f.col = (p, sz, o = {}) => kit.colBox(pp(p), sz, { yaw: yaw + (o.ry || 0), name: o.name });
  f.colCyl = (p, r, h) => kit.colCyl(pp(p), r, h);
  f.box = (mat, p, sz, o = {}) => {
    const bev = o.bev != null ? o.bev : Math.min(0.012, Math.min(sz[0], sz[1], sz[2]) * 0.28);
    out.arrays(mat, bevelBoxArrays(sz[0], sz[1], sz[2], bev), { pos: pp(p), quat: Qo(o), ext: o.ext });
    if (o.col) f.col(p, sz, o);
  };
  f.cyl = (mat, p, r, h, o = {}) => {
    const g = new THREE.CylinderGeometry(o.rt != null ? o.rt : r, o.rb != null ? o.rb : r, h, o.seg || 14, 1, !!o.open, o.t0 || 0, o.tl || Math.PI * 2);
    out.add(mat, g, { pos: pp(p), quat: Qo(o, AXQ[o.axis || 'y']), ext: o.ext }); g.dispose();
    if (o.col) f.colCyl(p, Math.max(r, o.rb || 0, o.rt || 0), h);
  };
  f.plane = (mat, p, w, h, o = {}) => { const g = new THREE.PlaneGeometry(w, h); out.add(mat, g, { pos: pp(p), quat: Qo(o), ext: o.ext }); g.dispose(); };
  f.sph = (mat, p, r, o = {}) => {
    const g = new THREE.SphereGeometry(r, o.seg || 12, Math.max(5, (o.seg || 12) >> 1), o.phi0 || 0, o.phi || Math.PI * 2, o.th0 || 0, o.th || Math.PI);
    out.add(mat, g, { pos: pp(p), quat: Qo(o), scale: [o.sx || 1, o.sy || 1, o.sz || 1], ext: o.ext }); g.dispose();
  };
  f.torus = (mat, p, R, r, o = {}) => {
    const g = new THREE.TorusGeometry(R, r, o.tube || 6, o.seg || 20, o.arc || Math.PI * 2);
    out.add(mat, g, { pos: pp(p), quat: Qo(o, TORQ[o.axis || 'z']), ext: o.ext }); g.dispose();
  };
  // profile [[r, y], …] revolved about local Y (or `axis`), traversed bottom→top for outward normals
  f.lathe = (mat, prof, o = {}) => {
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new V2(r, y)), o.seg || 24, o.phi0 || 0, o.phi || Math.PI * 2);
    out.add(mat, g, { pos: pp(o.pos || [0, 0, 0]), quat: Qo(o, AXQ[o.axis || 'y']), ext: o.ext }); g.dispose();
  };
  f.ext = (mat, pts, depth, o = {}) => {
    const g = extrudePoly(pts, depth, o.bevel || 0);
    out.add(mat, g, { pos: pp(o.pos || [0, 0, 0]), quat: Qo(o), ext: o.ext }); g.dispose();
  };
  f.tube = (mat, pts, r, o = {}) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new V3(...pp(q))), !!o.closed, 'catmullrom', o.tension != null ? o.tension : 0.1);
    const g = new THREE.TubeGeometry(curve, o.seg || Math.max(8, pts.length * 6), r, o.rseg || 8, !!o.closed);
    out.add(mat, g, {}); g.dispose();
  };
  f.beam = (mat, a, b, w, h, o = {}) => kit.beam(mat, pp(a), pp(b), w, h, o);
  f.sign = (text, p, o = {}) => kit.sign(text, pp(p), { w: o.w, h: o.h, style: o.style, rot: [0, yaw + (o.ry || 0), 0] });
  f.st = (id, p, size, o = {}) => stencils(kit).quad(id, pp(p), size, Qo(o));
  f.led = (color, pattern, p, sz = [0.016, 0.016, 0.006], o = {}) => f.box(kit.led(color, pattern), p, sz, { bev: 0, ...o });
  f.ledRow = (p, n, pitch, colors, o = {}) => { for (let i = 0; i < n; i++) f.led(colors[i % colors.length][0], colors[i % colors.length][1] || '', [p[0] + i * pitch, p[1], p[2]], o.sz || [0.014, 0.014, 0.006], o); };
  // straight-segment pipe run through local points (consecutive points differ along one axis); elbows = spheres, flanges every `fl` metres
  f.pipe = (mat, pts, r, o = {}) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ax = Math.abs(d[0]) >= Math.abs(d[1]) && Math.abs(d[0]) >= Math.abs(d[2]) ? 'x' : Math.abs(d[1]) >= Math.abs(d[2]) ? 'y' : 'z', k = AXI[ax];
      const len = Math.abs(d[k]), sg = Math.sign(d[k]) || 1;
      f.cyl(mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r, len, { axis: ax, seg: o.seg || 12 });
      const fm = o.fmat || 'steel';
      if (o.fl) for (let t = o.fl * 0.5; t < len - 0.05; t += o.fl) { const q = [a[0], a[1], a[2]]; q[k] += sg * t; f.cyl(fm, q, r * 1.38, 0.04, { axis: ax, seg: o.seg || 12 }); }
      if (o.band) for (let t = (o.bandAt || 0.3); t < len - 0.05; t += (o.bandEvery || 0.7)) { const q = [a[0], a[1], a[2]]; q[k] += sg * t; f.cyl(o.band, q, r * 1.06, o.bandW || 0.06, { axis: ax, seg: o.seg || 12 }); }
    }
    for (let i = 1; i < pts.length - 1; i++) f.sph(mat, pts[i], r * 1.02, { seg: 10 });
    if (o.ends !== false) for (const q of [pts[0], pts[pts.length - 1]]) f.sph(mat, q, r * 1.02, { seg: 8 });
  };
  // handwheel valve on a pipe along `axis` at p; stem points along local `stem` ('y'|'x'|'z')
  f.valve = (p, axis = 'z', r = 0.05, o = {}) => {
    const wm = o.wheel || 'abRed', st = o.stem || 'y';
    f.cyl(o.body || 'steel', p, r * 1.5, r * 2.6, { axis, seg: 12 });
    f.cyl('steel', p, r * 1.75, 0.03, { axis, seg: 12 });
    const q = [p[0], p[1], p[2]]; q[AXI[st]] += r * 2.4;
    f.cyl('steel', [p[0] + (st === 'x' ? r * 1.5 : 0), p[1] + (st === 'y' ? r * 1.5 : 0), p[2] + (st === 'z' ? r * 1.5 : 0)], r * 0.3, r * 3, { axis: st, seg: 6 });
    f.torus(wm, q, r * 1.25, r * 0.16, { axis: st, tube: 5, seg: 14 });
    f.cyl(wm, q, r * 0.3, r * 0.4, { axis: st, seg: 8 });
    f.cyl(wm, q, r * 0.1, r * 2.5, { axis: st === 'y' ? 'x' : 'y', seg: 4 });
    f.cyl(wm, q, r * 0.1, r * 2.5, { axis: st === 'z' ? 'x' : 'z', seg: 4 });
  };
  // analogue gauge facing local +z at p (dial r); needle angle a
  f.gauge = (p, r = 0.045, a = 0, o = {}) => {
    f.cyl('trim', p, r * 1.18, 0.022, { axis: 'z', seg: 14 });
    f.cyl('white', [p[0], p[1], p[2] + 0.009], r, 0.006, { axis: 'z', seg: 14 });
    f.box('trim', [p[0], p[1], p[2] + 0.016], [r * 1.5, 0.006, 0.003], { bev: 0, rz: a });
    f.box(o.led || 'emitRed', [p[0], p[1] - r * 0.55, p[2] + 0.014], [0.008, 0.006, 0.002], { bev: 0 });
  };
  return f;
}

// ───────────────────────── dynamic-mesh helpers ─────────────────────────
// sink compatible with frame(): collects geometry for ONE material into a MeshBuilder → build() → BufferGeometry
export function dynSink() {
  const b = new MeshBuilder('own', 1), m4 = new THREE.Matrix4();
  return { arrays: (mat, a, o) => b.addArrays(a.p, a.n, a.uv || null, a.idx, placement(o, m4)), add: (mat, g, o) => b.addGeometry(g, placement(o, m4)), build: () => b.build(), get empty() { return b.empty; } };
}
export function basicMat(r, g, bl, o = {}) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, bl), toneMapped: false, ...o });
  m.userData = { emissive: true, custom: true }; return m;
}
// lighting-mode scale for custom emissives. kind 'status' (indicators stay on in emergency) | 'core' (power-hungry glows die first)
export function modeK(s, kind = 'status') {
  switch (s.mode) {
    case 'alert': return kind === 'core' ? 0.8 + 0.2 * s.pulse : 0.55 + 0.45 * s.pulse;
    case 'emergency': return kind === 'core' ? 0.4 : 0.85;
    case 'off': return kind === 'core' ? 0.03 : 0.22;
    default: return 1;
  }
}
export const smooth = (cur, target, dt, rate = 3) => cur + (target - cur) * (1 - Math.exp(-dt * rate));

// ───────────────────────── shared materials ─────────────────────────
function netTexture() {
  const S = 256, c = cvs(S, S), g = c.getContext('2d'); g.clearRect(0, 0, S, S);
  g.strokeStyle = '#1b1e23'; g.lineWidth = 9; g.beginPath(); for (const k of [32, 96, 160, 224]) { g.moveTo(0, k); g.lineTo(S, k); g.moveTo(k, 0); g.lineTo(k, S); } g.stroke();
  g.strokeStyle = '#3a4048'; g.lineWidth = 3; g.beginPath(); for (const k of [30, 94, 158, 222]) { g.moveTo(0, k); g.lineTo(S, k); g.moveTo(k, 0); g.lineTo(k, S); } g.stroke();
  g.fillStyle = '#d8741f'; for (const a of [32, 96, 160, 224]) for (const b of [32, 96, 160, 224]) { g.beginPath(); g.arc(a, b, 8, 0, 6.283); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return { map: t };
}
function trackTexture() {
  const S = 64, c = cvs(S, S), g = c.getContext('2d');
  g.fillStyle = '#4a5058'; g.fillRect(0, 0, S, S); g.fillStyle = '#05070a'; g.fillRect(14, 0, 30, S); g.fillStyle = '#7b828c'; g.fillRect(12, 0, 2, S); g.fillRect(44, 0, 2, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return { map: t };
}
export function defMats(kit) {
  if (kit._bayMats) return; kit._bayMats = true;
  const d = (n, def) => { kit.defMat(n, def); return kit.mat(n); };
  d('abYellow', { color: 0xdcae12, rough: 0.5, metal: 0.1 });
  d('abRed', { color: 0xb3261e, rough: 0.45, metal: 0.1 });
  d('abGreen', { color: 0x2f9a62, rough: 0.5, metal: 0.1 });
  d('abBlue', { color: 0x2b63c6, rough: 0.45, metal: 0.1 });
  d('abCrateOlive', { color: 0x66724f, rough: 0.6, metal: 0.25 });
  d('abCrateGrey', { color: 0x8e959f, rough: 0.55, metal: 0.3 });
  d('abCrateTan', { color: 0xa89868, rough: 0.6, metal: 0.2 });
  d('abCopper', { color: 0xc9783b, rough: 0.36, metal: 0.55 });
  d('abCeramicDark', { color: 0x3a3f48, rough: 0.28, metal: 0.2, doubleSide: true });
  d('abSoot', { color: 0x141416, rough: 0.92, metal: 0.05 });
  d('abProbe', { color: 0xf2f3f5, rough: 0.28, metal: 0.15 });
  d('abNet', { tex: netTexture, uv: 'world', tile: 0.4, rough: 0.9, metal: 0, alphaTest: 0.5, doubleSide: true });
  d('abTrack', { tex: trackTexture, uv: 'world', tile: 0.2, rough: 0.5, metal: 0.5 });
}

// ───────────────────────── stencil atlas ─────────────────────────
const redrawOnFonts = (fn) => { onFontsReady(fn); try { if (typeof document !== 'undefined' && document.fonts) document.fonts.load("700 24px 'Rajdhani'").then(fn).catch(() => {}); } catch (e) { /* fonts API unavailable */ } };
const U = FONTS.ui, DSP = FONTS.disp;
const txt = (g, s, x, y, size, col, o = {}) => {
  g.save(); g.textAlign = o.al || 'center'; g.textBaseline = 'middle';
  let sz = size; const setF = () => { g.font = `${o.w || 700} ${sz}px ${o.f || U}`; if ('letterSpacing' in g) g.letterSpacing = `${o.ls != null ? Math.round(o.ls * sz / size) : Math.round(sz * 0.1)}px`; };
  setF();
  if (o.maxW) { let guard = 0; while (g.measureText(s).width > o.maxW && sz > 8 && guard++ < 60) { sz -= 2; setF(); } }
  if (o.stroke) { g.lineWidth = o.sw || sz * 0.14; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); }
  g.fillStyle = col; g.fillText(s, x, y); g.restore();
};
const worn = (g, w, h, seed, amt = 1) => {
  const R = mulberry(seed); g.save(); g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < w * h / 700 * amt; i++) { g.fillStyle = `rgba(0,0,0,${0.35 + R() * 0.6})`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 2); }
  for (let i = 0; i < 5 * amt; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + R() * 0.4})`; g.fillRect(R() * w, R() * h, 4 + R() * 14, 1 + R() * 2); }
  g.restore();
};
const diamond = (g, cx, cy, r, fill, edge, glyph) => {
  g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4); g.fillStyle = fill; g.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); g.strokeStyle = edge; g.lineWidth = r * 0.09; g.strokeRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2); g.rotate(-Math.PI / 4); glyph && glyph(g, r); g.restore();
};
const arrowUp = (g, cx, cy, s, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.7, cy); g.lineTo(cx + s * 0.28, cy); g.lineTo(cx + s * 0.28, cy + s); g.lineTo(cx - s * 0.28, cy + s); g.lineTo(cx - s * 0.28, cy); g.lineTo(cx - s * 0.7, cy); g.closePath(); g.fill(); };
const trefoil = (g, cx, cy, r, col) => {
  g.fillStyle = col; for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 3; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a - Math.PI / 6, a + Math.PI / 6); g.closePath(); g.fill(); }
  g.beginPath(); g.arc(cx, cy, r * 0.17, 0, 6.283); g.fill();
};
const plate = (g, w, h, bg, edge) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = edge; g.lineWidth = Math.max(2, h * 0.04); g.strokeRect(g.lineWidth, g.lineWidth, w - 2 * g.lineWidth, h - 2 * g.lineWidth); };
const WH = '#e9e6dc', YL = '#e4b400', OR = '#e8742a', BK = '#15171a', RD = '#cf3a2c', CY = '#35c7e6';
// id → [w px, h px, draw]. ~400 px per metre unless noted.
const SPEC = {
  sk: [256, 96, (g, w, h) => { txt(g, 'SURVEY KIT', w / 2, h * 0.32, 44, WH); txt(g, 'SK-03 · 12 UNITS', w / 2, h * 0.74, 30, WH); worn(g, w, h, 3); }],
  core: [256, 96, (g, w, h) => { txt(g, 'CORE SAMPLES', w / 2, h * 0.34, 42, BK); txt(g, 'COLD CHAIN −40 °C', w / 2, h * 0.74, 26, BK); worn(g, w, h, 4); }],
  frag: [256, 96, (g, w, h) => { txt(g, 'FRAGILE', w / 2 + 20, h * 0.5, 56, RD, { ls: 6 }); g.strokeStyle = RD; g.lineWidth = 5; g.beginPath(); g.moveTo(22, 18); g.lineTo(58, 18); g.lineTo(40, 52); g.closePath(); g.moveTo(40, 52); g.lineTo(40, 78); g.moveTo(26, 78); g.lineTo(54, 78); g.stroke(); worn(g, w, h, 5); }],
  tup: [256, 96, (g, w, h) => { arrowUp(g, 48, 48, 30, WH); arrowUp(g, 208, 48, 30, WH); txt(g, 'THIS SIDE', w / 2, h * 0.3, 34, WH); txt(g, 'UP', w / 2, h * 0.72, 34, WH); worn(g, w, h, 6); }],
  hx: [256, 96, (g, w, h) => { plate(g, w, h, '#14181d', OR); txt(g, 'ORPHEUS · HX-02', w / 2, h * 0.42, 36, WH, { w: 800, maxW: w * 0.88 }); g.fillStyle = OR; g.fillRect(24, h * 0.72, w - 48, 6); worn(g, w, h, 7); }],
  n2: [256, 96, (g, w, h) => { plate(g, w, h, 'rgba(20,24,28,0.0)', WH); txt(g, 'N₂ · PRESSURISED', w / 2, h * 0.36, 36, WH); txt(g, 'VENT BEFORE OPENING', w / 2, h * 0.74, 22, YL); worn(g, w, h, 8); }],
  hoist: [256, 96, (g, w, h) => { arrowUp(g, 40, 48, 26, YL); txt(g, 'HOIST POINT', w / 2 + 22, h * 0.5, 44, YL); worn(g, w, h, 9); }],
  max: [256, 96, (g, w, h) => { txt(g, 'MAX 450 KG', w / 2, h * 0.36, 54, BK); txt(g, 'DO NOT STACK > 3', w / 2, h * 0.76, 26, BK); worn(g, w, h, 10); }],
  spares: [256, 96, (g, w, h) => { txt(g, 'SPARES · ENG-3', w / 2, h * 0.36, 46, WH); txt(g, 'DRIVE SECTION ONLY', w / 2, h * 0.76, 26, OR); worn(g, w, h, 11); }],
  food: [256, 96, (g, w, h) => { txt(g, 'STORES · 30 DAY', w / 2, h * 0.4, 44, BK); g.fillStyle = BK; g.fillRect(20, h * 0.74, w - 40, 5); worn(g, w, h, 12); }],
  eur1: [256, 96, (g, w, h) => { plate(g, w, h, '#14181d', OR); txt(g, 'EURYDICE · HX-01', w / 2, h * 0.42, 36, WH, { w: 800, maxW: w * 0.88 }); g.fillStyle = OR; g.fillRect(24, h * 0.72, w - 48, 6); worn(g, w, h, 13, 2); }],
  dg: [128, 128, (g, w, h) => { diamond(g, 64, 64, 56, '#e9b500', BK, (gg, r) => { gg.fillStyle = BK; gg.beginPath(); gg.moveTo(-r * 0.04, -r * 0.35); gg.quadraticCurveTo(r * 0.34, r * 0.0, r * 0.12, r * 0.28); gg.quadraticCurveTo(-r * 0.02, r * 0.38, -r * 0.2, r * 0.22); gg.quadraticCurveTo(-r * 0.3, 0, -r * 0.04, -r * 0.35); gg.fill(); }); worn(g, w, h, 14); }],
  hv: [128, 128, (g, w, h) => { diamond(g, 64, 64, 56, '#e9b500', BK, (gg, r) => { gg.fillStyle = BK; gg.beginPath(); gg.moveTo(r * 0.12, -r * 0.4); gg.lineTo(-r * 0.2, r * 0.04); gg.lineTo(0, r * 0.04); gg.lineTo(-r * 0.1, r * 0.4); gg.lineTo(r * 0.22, -r * 0.08); gg.lineTo(0, -r * 0.08); gg.closePath(); gg.fill(); }); worn(g, w, h, 15); }],
  rad: [128, 128, (g, w, h) => { g.fillStyle = '#e9b500'; g.beginPath(); g.arc(64, 64, 58, 0, 6.283); g.fill(); g.strokeStyle = BK; g.lineWidth = 6; g.stroke(); trefoil(g, 64, 64, 44, BK); worn(g, w, h, 16); }],
  bay: [640, 140, (g, w, h) => { plate(g, w, h, '#14181d', YL); txt(g, 'CARGO BAY 2', w / 2, h * 0.46, 96, YL, { w: 800, ls: 12, maxW: w * 0.88 }); g.fillStyle = YL; g.fillRect(20, h * 0.84, w - 40, 7); worn(g, w, h, 17, 1.2); }],
  ramp: [512, 160, (g, w, h) => { plate(g, w, h, '#14181d', YL); txt(g, 'RAMP', w / 2, h * 0.4, 110, WH, { w: 800, ls: 18, maxW: w * 0.8 }); g.fillStyle = YL; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(40 + i * 62, h * 0.78); g.lineTo(70 + i * 62, h * 0.78); g.lineTo(90 + i * 62, h * 0.92); g.lineTo(60 + i * 62, h * 0.92); g.closePath(); g.fill(); } worn(g, w, h, 18, 1.2); }],
  rampzone: [640, 90, (g, w, h) => { plate(g, w, h, '#e4b400', BK); txt(g, 'RAMP ZONE — KEEP CLEAR', w / 2, h * 0.52, 56, BK, { w: 800, ls: 6, maxW: w * 0.92 }); worn(g, w, h, 19, 0.8); }],
  fire: [256, 128, (g, w, h) => { plate(g, w, h, '#b3261e', WH); txt(g, 'FIRE', w / 2, h * 0.34, 54, WH, { w: 800 }); txt(g, 'SUPPRESSION', w / 2, h * 0.7, 38, WH); }],
  tool: [704, 448, (g, w, h) => {
    g.fillStyle = '#20252b'; g.fillRect(0, 0, w, h); g.fillStyle = '#2d343c'; for (let y = 24; y < h; y += 32) for (let x = 24; x < w; x += 32) { g.beginPath(); g.arc(x, y, 3, 0, 6.283); g.fill(); }
    g.strokeStyle = 'rgba(235,238,242,0.9)'; g.lineWidth = 3; g.lineCap = 'round';
    const wr = (x, y, len) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke(); g.beginPath(); g.arc(x - 6, y, 14, 0.5, 5.8); g.stroke(); g.beginPath(); g.arc(x + len + 6, y, 11, 3.6, 2.7, true); g.stroke(); };
    wr(60, 70, 190); wr(60, 110, 160); wr(60, 150, 130); wr(60, 190, 110);
    g.strokeRect(330, 50, 130, 60); g.strokeRect(330, 130, 130, 50); g.beginPath(); g.arc(560, 90, 40, 0, 6.283); g.stroke(); g.beginPath(); g.arc(560, 90, 18, 0, 6.283); g.stroke();
    g.strokeRect(60, 250, 90, 120); g.strokeRect(180, 250, 44, 120); g.strokeRect(250, 250, 44, 120); g.beginPath(); g.moveTo(340, 250); g.lineTo(520, 250); g.lineTo(520, 280); g.lineTo(340, 280); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(350, 300); g.lineTo(560, 380); g.stroke(); g.strokeRect(560, 250, 90, 110);
    txt(g, 'TOOL BOARD · CARGO BAY 2', 24, h - 26, 26, 'rgba(134,236,255,0.9)', { al: 'left' }); txt(g, 'INVENTORY 14/14', w - 24, h - 26, 26, YL, { al: 'right' });
  }],
  danger: [512, 200, (g, w, h) => { plate(g, w, h, '#e4b400', BK); txt(g, 'DANGER', w / 2, h * 0.3, 80, BK, { w: 800 }); txt(g, 'FUSION TORCH · HIGH ENERGY', w / 2, h * 0.62, 34, BK); txt(g, 'KEEP CLEAR OF TORUS WHEN ARMED', w / 2, h * 0.84, 24, BK); }],
  drive: [384, 96, (g, w, h) => { plate(g, w, h, '#14181d', CY); txt(g, 'DRIVE CORE', w / 2, h * 0.52, 64, WH, { w: 800, ls: 12, maxW: w * 0.86 }); worn(g, w, h, 20, 0.6); }],
  coolA: [256, 64, (g, w, h) => { txt(g, 'COOLANT A', w / 2, h * 0.5, 42, CY, { w: 800 }); worn(g, w, h, 21); }],
  coolB: [256, 64, (g, w, h) => { txt(g, 'COOLANT B', w / 2, h * 0.5, 42, OR, { w: 800 }); worn(g, w, h, 22); }],
  he3: [320, 80, (g, w, h) => { txt(g, 'HE-3 RESERVE', w / 2, h * 0.5, 50, BK, { w: 800 }); worn(g, w, h, 23); }],
  d2: [320, 80, (g, w, h) => { txt(g, 'D₂ FEED', w / 2, h * 0.5, 54, BK, { w: 800 }); worn(g, w, h, 24); }],
  ln2: [320, 80, (g, w, h) => { txt(g, 'LN₂ · 77 K', w / 2, h * 0.5, 54, WH, { w: 800 }); worn(g, w, h, 25); }],
  engw: [640, 140, (g, w, h) => { plate(g, w, h, '#14181d', OR); txt(g, 'ENGINEERING', w / 2, h * 0.46, 92, WH, { w: 800, ls: 14, maxW: w * 0.88 }); g.fillStyle = OR; g.fillRect(20, h * 0.84, w - 40, 7); worn(g, w, h, 26, 1.2); }],
  arrow: [128, 48, (g, w, h) => { g.fillStyle = WH; g.beginPath(); g.moveTo(10, 14); g.lineTo(76, 14); g.lineTo(76, 4); g.lineTo(118, 24); g.lineTo(76, 44); g.lineTo(76, 34); g.lineTo(10, 34); g.closePath(); g.fill(); worn(g, w, h, 27); }],
  frame: [256, 64, (g, w, h) => { plate(g, w, h, '#14181d', WH); txt(g, 'FRAME 25', w / 2, h * 0.52, 40, WH, { maxW: w * 0.86 }); worn(g, w, h, 28, 0.6); }],
  sp1: [128, 40, (g, w, h) => { txt(g, 'SP-01', w / 2, h / 2, 30, BK, { w: 800 }); }], sp2: [128, 40, (g, w, h) => { txt(g, 'SP-02', w / 2, h / 2, 30, BK, { w: 800 }); }],
  sp3: [128, 40, (g, w, h) => { txt(g, 'SP-03', w / 2, h / 2, 30, BK, { w: 800 }); }], sp4: [128, 40, (g, w, h) => { txt(g, 'SP-04', w / 2, h / 2, 30, BK, { w: 800 }); }],
  sp5: [128, 40, (g, w, h) => { txt(g, 'SP-05', w / 2, h / 2, 30, BK, { w: 800 }); }], sp6: [128, 40, (g, w, h) => { txt(g, 'SP-06', w / 2, h / 2, 30, BK, { w: 800 }); }],
};
export function stencils(kit) {
  if (kit._stencils) return kit._stencils;
  const AW = 2048, AH = 1024, cv = cvs(AW, AH), g = cv.getContext('2d'), ids = Object.keys(SPEC), place = {};
  let x = 0, y = 0, rowH = 0;
  for (const id of ids) { const [w, h] = SPEC[id]; if (x + w > AW) { x = 0; y += rowH + 2; rowH = 0; } place[id] = { x, y, w, h }; x += w + 2; rowH = Math.max(rowH, h); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const draw = () => { g.clearRect(0, 0, AW, AH); for (const id of ids) { const r = place[id]; g.save(); g.translate(r.x, r.y); g.beginPath(); g.rect(0, 0, r.w, r.h); g.clip(); SPEC[id][2](g, r.w, r.h); g.restore(); } tex.needsUpdate = true; };
  draw(); redrawOnFonts(draw);
  kit.defMat('abStencil', { tex: () => ({ map: tex }), uv: 'own', rough: 0.85, metal: 0, alphaTest: 0.5 });
  const m = kit.mat('abStencil'); m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  const NRM = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], IDX = [0, 1, 2, 0, 2, 3];
  return (kit._stencils = {
    aspect: (id) => place[id].w / place[id].h,
    quad(id, pos, size, quat) {
      const r = place[id]; if (!r) throw new Error('stencil: unknown ' + id);
      const w = size[0], h = size[1], u0 = r.x / AW, u1 = (r.x + r.w) / AW, v0 = 1 - (r.y + r.h) / AH, v1 = 1 - r.y / AH;
      kit.arrays('abStencil', { p: [-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0], n: NRM, uv: [u0, v0, u1, v0, u1, v1, u0, v1], idx: IDX }, { pos, quat });
    },
  });
}

// ───────────────────────── floor paint decal ─────────────────────────
// draw(g, W, H, X, Z, px): X(x) / Z(z) convert world metres to canvas pixels. One lit transparent plane (polygon-offset above the deck).
export function floorDecal(kit, { x0, x1, z0, z1, y, px = 280, draw, name = 'floorPaint', opacity = 1 }) {
  const W = Math.round((x1 - x0) * px), H = Math.round((z1 - z0) * px), cv = cvs(W, H), g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const redraw = () => { g.clearRect(0, 0, W, H); draw(g, W, H, (x) => (x - x0) * px, (z) => (z - z0) * px, px); tex.needsUpdate = true; };
  redraw(); redrawOnFonts(redraw);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, roughness: 0.78, metalness: 0.05 });
  const mesh = kit.mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat, { pos: [(x0 + x1) / 2, y, (z0 + z1) / 2], rot: [-Math.PI / 2, 0, 0], name });
  mesh.renderOrder = 4; return mesh;
}
export const paint = { txt, worn, diamond, arrowUp, trefoil, plate, WH, YL, OR, BK, RD, CY };
