// Shared helpers for the science rooms (lab / medbay / LYRA core): wall-aligned placement frames, bench modules, stools, canvases.
// Room interiors (starboard side): x 1.25 (corridor wall face) … 3.925 (outer lining face); z partitions at faces 3.075|9.925|10.075|13.925|14.075|17.925.
export const X0 = 1.25, X1 = 3.925, FL = -1.2, CE = 1.35, BT = -0.3;      // BT = bench-top height
export const ZR = { lab: [3.075, 9.925], med: [10.075, 13.925], core: [14.075, 17.925] };
const FACE = { E: -Math.PI / 2, W: Math.PI / 2, N: 0, S: Math.PI };       // yaw that turns a +Z-facing plane to face into the room

export function defMats(kit) {
  const d = kit.defMat;
  d('sciCab', { color: 0xdfe4ea, rough: 0.5, metal: 0.2 });               // painted steel cabinet
  d('sciCabDk', { color: 0x4b535d, rough: 0.5, metal: 0.4 });
  d('sciTop', { color: 0x1e252c, rough: 0.3, metal: 0.2 });               // dark epoxy worktop
  d('sciSteel', { color: 0xb8c0ca, rough: 0.3, metal: 0.55 });            // stainless
  d('sciStone', { color: 0x3a3f46, rough: 0.7, metal: 0.1 });             // granite pier
  d('sciTeal', { color: 0x2ba99b, rough: 0.4, metal: 0.1 });              // medical teal
  d('sciRed', { color: 0xc42a2a, rough: 0.45, metal: 0.05 });
  d('sciGlass', { color: 0xbfe2ff, rough: 0.03, metal: 0, transparent: true, opacity: 0.17, depthWrite: false, doubleSide: true, noShadow: true });
  d('sciIce', { color: 0xcfe6fa, rough: 0.15, metal: 0, transparent: true, opacity: 0.78, depthWrite: false, noShadow: true });
  d('sciSoot', { color: 0x0e0d0c, rough: 0.9, metal: 0 });
  d('sciMatt', { color: 0xd3dbe2, rough: 0.85, metal: 0 });                // pod mattress
  d('sciCurtain', { color: 0x9fc9c2, rough: 0.95, metal: 0, doubleSide: true });
  d('sciMirror', { color: 0xc5d6e4, rough: 0.08, metal: 0.25 });
  d('sciBlanket', { color: 0xc9622c, rough: 1, metal: 0 });
}

// euler triple (XYZ order, as kit placement/screen use) equivalent to yaw-then-pitch (YXZ): tilt a +Z-facing plane about its own horizontal axis
export const eul = (THREE, yaw, pitch = 0, roll = 0) => { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')); const e = new THREE.Euler().setFromQuaternion(q, 'XYZ'); return [e.x, e.y, e.z]; };

// canvas → CanvasTexture (sRGB)
export function canvasTex(kit, w, h, draw) {
  const c = kit.T.cvs(w, h), g = c.getContext('2d'); draw(g, w, h);
  const t = new kit.THREE.CanvasTexture(c); t.colorSpace = kit.THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; return t;
}

// wall frame: u runs along the wall (world z for E/W, world x for N/S), v = distance from the wall into the room, y world.
export function wall(kit, name, rz) {
  const lat = name === 'E' || name === 'W', yaw = FACE[name];
  const pt = (u, y, v) => (name === 'E' ? [X1 - v, y, u] : name === 'W' ? [X0 + v, y, u] : name === 'N' ? [u, y, rz[0] + v] : [u, y, rz[1] - v]);
  const sz = (wu, h, wv) => (lat ? [wv, h, wu] : [wu, h, wv]);
  return {
    kit, name, yaw, pt, sz, lat,
    box: (m, u, y, v, wu, h, wv, o = {}) => kit.box(m, pt(u, y, v), sz(wu, h, wv), o),
    cyl: (m, u, y, v, r, h, o = {}) => kit.cyl(m, pt(u, y, v), r, h, o),
    cylU: (m, u, y, v, r, len, o = {}) => kit.cyl(m, pt(u, y, v), r, len, { ...o, axis: lat ? 'z' : 'x' }),
    cylV: (m, u, y, v, r, len, o = {}) => kit.cyl(m, pt(u, y, v), r, len, { ...o, axis: lat ? 'x' : 'z' }),
    sph: (m, u, y, v, r, o = {}) => kit.sphere(m, pt(u, y, v), r, o),
    col: (u, y, v, wu, h, wv, o = {}) => kit.colBox(pt(u, y, v), sz(wu, h, wv), o),
    sign: (text, u, y, v, w, h, style = 'plate') => kit.sign(text, pt(u, y, v), { w, h, rot: [0, yaw, 0], style }),
    beam: (m, a, b, w, h, o = {}) => kit.beam(m, pt(...a), pt(...b), w, h, o),   // a,b = [u,y,v]
    // hinged door leaf swung open by th (rad) about a vertical hinge at (uh, vh); hs = +1 hinge at the +u edge, −1 at the −u edge
    swing: (m, uh, vh, wd, th, hs, y, h, thick = 0.03, o = {}) => {
      const du = -hs * Math.cos(th), dv = Math.sin(th), c = [uh + du * wd / 2, vh + dv * wd / 2];
      const [dx, dz] = name === 'E' ? [-dv, du] : name === 'W' ? [dv, du] : name === 'N' ? [du, dv] : [du, -dv];
      kit.box(m, pt(c[0], y, c[1]), sz(wd, h, thick), { bev: 0.006, ...o, yaw: lat ? Math.atan2(dx, dz) : Math.atan2(-dz, dx) });
    },
  };
}

// base-cabinet run with worktop: u0..u1 along the wall, depth d from the wall. o: {accent, drawers, body, col}
export function bench(f, u0, u1, d, o = {}) {
  const w = u1 - u0, uc = (u0 + u1) / 2, y0 = FL + 0.1, y1 = BT - 0.04, ym = (y0 + y1) / 2;
  const n = Math.max(1, Math.round(w / (o.pw || 0.55))), pw = w / n;
  f.box('trim', uc, FL + 0.05, d / 2 - 0.025, w - 0.03, 0.1, d - 0.08, { bev: 0.004 });
  f.box(o.body || 'sciCab', uc, ym, d / 2, w, y1 - y0, d, { bev: 0.006 });
  f.box('sciTop', uc, BT - 0.02, d / 2 + 0.012, w + 0.01, 0.04, d + 0.024, { bev: 0.008 });
  for (let i = 0; i <= n; i++) f.box('trim', u0 + i * pw, ym, d + 0.002, 0.007, y1 - y0 - 0.02, 0.006, { bev: 0 });
  for (let i = 0; i < n; i++) {
    const c = u0 + (i + 0.5) * pw;
    if (o.drawers && i % 2 === 0) {
      for (let k = 1; k < 3; k++) f.box('trim', c, y0 + (y1 - y0) * k / 3, d + 0.002, pw - 0.03, 0.006, 0.006, { bev: 0 });
      for (let k = 0; k < 3; k++) f.box('sciSteel', c, y0 + (y1 - y0) * (k + 0.66) / 3, d + 0.011, 0.16, 0.014, 0.014, { bev: 0.003 });
    } else f.box('sciSteel', c + pw * 0.36, ym + 0.14, d + 0.011, 0.014, 0.16, 0.014, { bev: 0.003 });
  }
  if (o.accent) f.box(o.accent, uc, FL + 0.118, d + 0.001, w - 0.05, 0.012, 0.004, { bev: 0 });
  if (o.col !== false) f.col(uc, (FL + BT) / 2, d / 2, w, BT - FL, d);
}

// lab stool (swivel, 5-star base)
export function stool(kit, x, z, o = {}) {
  const h = o.h || 0.66, y0 = FL, seat = o.seat || 'plasticDark';
  kit.cyl(seat, [x, y0 + h, z], 0.17, 0.05, { seg: 20 });
  kit.cyl('sciSteel', [x, y0 + h - 0.04, z], 0.185, 0.02, { seg: 20 });
  kit.cyl('sciSteel', [x, y0 + h / 2 - 0.03, z], 0.018, h - 0.12, { seg: 8 });
  kit.torus('sciSteel', [x, y0 + 0.27, z], 0.14, 0.008, { seg: 20, tube: 5 });
  for (let i = 0; i < 5; i++) {
    const a = i * 1.2566 + (o.yaw || 0), px = x + Math.cos(a) * 0.21, pz = z + Math.sin(a) * 0.21;
    kit.beam('trim', [x, y0 + 0.12, z], [px, y0 + 0.07, pz], 0.026, 0.02, { bev: 0.004 });
    kit.cyl('rubber', [px, y0 + 0.032, pz], 0.025, 0.05, { seg: 8 });
  }
  kit.colCyl([x, y0 + 0.35, z], 0.19, 0.7);
}

// small helper: a row of evenly spaced items
export const row = (n, a, b, fn) => { for (let i = 0; i < n; i++) fn(a + (b - a) * (n === 1 ? 0.5 : i / (n - 1)), i); };
