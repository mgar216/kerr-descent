// Flight-deck helpers (used by flightdeck.js + fd_*.js): matrix-frame placement, dash-surface mapping, diagonal-wall frames, small prop makers, materials.
// "Panel convention" for every frame F: local +z = surface normal (out of the panel), +y = up the surface, +x = viewer's right.
import * as THREE from 'three';
import { bevelBoxArrays } from './builder.js';

const V3 = THREE.Vector3, M4 = THREE.Matrix4;
export const lerp = (a, b, t) => a + (b - a) * t;
export const DASH_SLOPE = Math.atan2(0.58, 0.56);                 // classic cockpit dash slope (core.js buildCockpit)
export const dashBend = (x) => 0.18 * (x / 1.25) ** 2;
export const PI = Math.PI;

export function defMats(kit) {
  const T = kit.T;
  kit.defMat('fdDash', { tex: T.carbonTrim, uv: 'world', tile: 1.5, rough: 1, metal: 1, color: 0x8a909a });
  kit.defMat('fdShell', { color: 0x58606b, rough: 0.5, metal: 0.45 });
  kit.defMat('fdShellL', { color: 0xaeb5be, rough: 0.5, metal: 0.3 });
  kit.defMat('fdRed', { color: 0xc4221c, rough: 0.45, metal: 0.1 });
  kit.defMat('fdYellow', { color: 0xdca818, rough: 0.5, metal: 0.1 });
  kit.defMat('fdSeat', { tex: T.fabric, uv: 'world', tile: 0.4, rough: 1, metal: 0, color: 0x8497b8 });
  kit.defMat('fdPleather', { color: 0x2b2e36, rough: 0.45, metal: 0.05 });
  kit.defMat('fdWebbing', { tex: T.fabric, uv: 'world', tile: 0.25, rough: 1, metal: 0, color: kit.eur ? 0x8a5a38 : 0xe0732a });
  kit.defMat('fdPlaque', { tex: () => ({ map: T.plaqueTex(kit.eur) }), uv: 'own', rough: 0.5, metal: 0.15 });
}

export function makeU(kit) {
  const L = kit.L, FD = L.FLIGHTDECK, WT = L.WALL_T;
  const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new V3(), _s = new V3(1, 1, 1), _l = new M4();
  const ID = new M4();
  // frame: yaw about Y (outer), pitch about X, roll about Z (inner)
  const frame = (pos = [0, 0, 0], yaw = 0, pitch = 0, roll = 0) => new M4().compose(_p.set(pos[0], pos[1], pos[2]), _q.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ')), _s.set(1, 1, 1));
  const at = (F, c, o = {}) => {
    _l.compose(_p.set(c[0], c[1], c[2] || 0), o.rot ? _q.setFromEuler(_e.set(o.rot[0], o.rot[1], o.rot[2], o.order || 'XYZ')) : _q.identity(), o.scale ? _s.set(o.scale[0], o.scale[1], o.scale[2]) : _s.set(1, 1, 1));
    return new M4().multiplyMatrices(F, _l);
  };
  const box = (F, mat, c, s, o = {}) => { const m = Math.min(s[0], s[1], s[2]); kit.arrays(mat, bevelBoxArrays(s[0], s[1], s[2], m < 0.03 ? 0 : o.bev != null ? o.bev : Math.min(0.012, m * 0.28)), { matrix: at(F, c, o) }); };
  const cyl = (F, mat, c, r, h, o = {}) => {
    const g = new THREE.CylinderGeometry(o.rt != null ? o.rt : r, o.rb != null ? o.rb : r, h, o.seg || 14, 1, !!o.open, o.t0 || 0, o.tl || PI * 2);
    kit.add(mat, g, { matrix: at(F, c, { rot: o.axis === 'x' ? [0, 0, PI / 2] : o.axis === 'z' ? [PI / 2, 0, 0] : o.rot, order: o.order }) }); g.dispose();
  };
  const sph = (F, mat, c, r, o = {}) => {
    const g = new THREE.SphereGeometry(r, o.seg || 10, Math.max(4, (o.seg || 10) >> 1), 0, o.phi || PI * 2, 0, o.theta || PI);
    kit.add(mat, g, { matrix: at(F, c, { rot: o.rot, scale: o.scale }) }); g.dispose();
  };
  const torus = (F, mat, c, R, r, o = {}) => {
    const g = new THREE.TorusGeometry(R, r, o.tube || 6, o.seg || 20, o.arc || PI * 2);
    kit.add(mat, g, { matrix: at(F, c, { rot: o.axis === 'x' ? [0, PI / 2, 0] : o.axis === 'y' ? [PI / 2, 0, 0] : o.rot }) }); g.dispose();
  };
  const tube = (F, mat, pts, r, o = {}) => {
    const P = pts.map((p) => new V3(p[0], p[1], p[2]).applyMatrix4(F));
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P, !!o.closed, 'catmullrom', o.tension != null ? o.tension : 0.1), o.seg || Math.max(8, pts.length * 6), r, o.rseg || 6, !!o.closed);
    kit.add(mat, g); g.dispose();
  };
  const beam = (F, mat, a, b, w, h, o = {}) => { const A = new V3(a[0], a[1], a[2] || 0).applyMatrix4(F), B = new V3(b[0], b[1], b[2] || 0).applyMatrix4(F); kit.beam(mat, [A.x, A.y, A.z], [B.x, B.y, B.z], w, h, o); };
  const sign = (F, text, c, o = {}) => {
    const M = at(F, c, { rot: o.rot }), p = new V3().setFromMatrixPosition(M), e = new THREE.Euler().setFromRotationMatrix(M, 'XYZ');
    kit.sign(text, [p.x, p.y, p.z], { w: o.w || 0.14, h: o.h || 0.035, style: o.style, rot: [e.x, e.y, e.z] });
  };
  // quad strip between two polylines A (i) and B (i); face the `hint` direction
  const ribbon = (mat, A, B, hint) => {
    const p = [], n = [], idx = [], h = new V3(hint[0], hint[1], hint[2]);
    for (let i = 0; i < A.length - 1; i++) {
      const a = new V3(...A[i]), b = new V3(...A[i + 1]), c = new V3(...B[i]), d = new V3(...B[i + 1]);
      const nn = new V3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize(), flip = nn.dot(h) < 0; if (flip) nn.negate();
      const base = p.length / 3; for (const q of [a, b, c, d]) { p.push(q.x, q.y, q.z); n.push(nn.x, nn.y, nn.z); }
      if (flip) idx.push(base, base + 3, base + 1, base, base + 2, base + 3); else idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
    kit.arrays(mat, { p, n, idx });
  };

  // ── dash surface mapping (identical to the classic cockpit: bottom edge y −1.02 z −0.42, top edge y −0.44 z −0.98, bend 0.18·(x/1.25)²) ──
  const dashPt = (x, v) => new V3(x, lerp(-1.02, -0.44, v), lerp(-0.42, -0.98, v) + dashBend(x));
  const dashFrame = (x, v, off = 0, roll = 0) => {
    const X = new V3(1, 0, 0.2304 * x).normalize(), N = new V3().crossVectors(X, new V3(0, 0.58, -0.56)).normalize(), Y = new V3().crossVectors(N, X);
    const m = new M4().makeBasis(X, Y, N).setPosition(dashPt(x, v).addScaledVector(N, off));
    return roll ? m.multiply(new M4().makeRotationZ(roll)) : m;
  };
  // ── diagonal flare wall frames. side +1 starboard / −1 port. lx = along the wall (viewer's right), d = standoff from the room-side surface ──
  const diag = (side) => {
    const x0 = side * FD.podHW, z0 = FD.podZ1, x1 = side * FD.bayHW, z1 = FD.flareZ1, dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), tx = dx / len, tz = dz / len;
    const nx = -side * tz, nz = side * tx, yaw = Math.atan2(nx, nz), ux = Math.cos(yaw), uz = -Math.sin(yaw);
    const mx = (x0 + x1) / 2 + nx * WT / 2, mz = (z0 + z1) / 2 + nz * WT / 2;
    const pt = (lx, d = 0) => [mx + ux * lx + nx * d, mz + uz * lx + nz * d];
    const fr = (lx, y, d = 0, pitch = 0) => { const [px, pz] = pt(lx, d); return frame([px, y, pz], yaw, pitch); };
    const col = (lx0, lx1, d0, d1, y0, y1) => { const [cx, cz] = pt((lx0 + lx1) / 2, (d0 + d1) / 2); return kit.colBox([cx, (y0 + y1) / 2, cz], [lx1 - lx0, y1 - y0, d1 - d0], { yaw }); };
    return { side, len, yaw, n: [nx, nz], u: [ux, uz], pt, fr, col };
  };
  // aft bulkhead (z = 2.4, flight-deck face at 2.325): local +x = world −x
  const aft = (xw, y, d = 0) => frame([xw, y, 2.4 - WT / 2 - d], PI);

  // ── small prop makers (panel convention) ──
  const rnd = kit.rand(0xfdfd);
  const toggle = (F, c, o = {}) => {
    const x = c[0], y = c[1], z = c[2] || 0, t = o.tilt != null ? o.tilt : 0.3;
    cyl(F, 'darkMetal', [x, y, z + 0.004], 0.011, 0.008, { axis: 'z', seg: 8 });
    cyl(F, 'steel', [x, y - 0.002 - t * 0.012, z + 0.0205], 0.0042, 0.026, { rot: [PI / 2 + t, 0, 0], seg: 6 });
    sph(F, o.tip || 'plastic', [x, y - 0.0035 - t * 0.026, z + 0.0325], 0.0058, { seg: 6 });
    if (o.guard) box(F, 'fdRed', [x, y + 0.002 + 0.0075, z + 0.013], [0.032, 0.028, 0.0035], { rot: [1.05, 0, 0], bev: 0.001 });
  };
  const led = (F, c, color = 'Green', pat = '', s = 0.012) => {
    if (kit.eur) { if (rnd() > 0.26) { box(F, 'screenOff', [c[0], c[1], (c[2] || 0) + 0.002], [s, s, 0.004], { bev: 0 }); return; } color = rnd() < 0.6 ? 'Amber' : 'Red'; pat = rnd() < 0.55 ? 'Rand' : ''; }
    box(F, kit.led(color, pat), [c[0], c[1], (c[2] || 0) + 0.002], [s, s, 0.004], { bev: 0 });
  };
  const tile = (F, c, w, h, mat = 'emitCyan') => { box(F, 'plasticDark', [c[0], c[1], (c[2] || 0) + 0.003], [w + 0.006, h + 0.006, 0.006], { bev: 0.001 }); box(F, kit.eur ? (rnd() < 0.18 ? 'emitAmber' : 'screenOff') : mat, [c[0], c[1], (c[2] || 0) + 0.0065], [w, h, 0.003], { bev: 0 }); };
  const rocker = (F, c, o = {}) => { const [x, y, z = 0] = c; box(F, 'plasticDark', [x, y, z + 0.004], [0.022, 0.03, 0.008], { bev: 0.002 }); box(F, o.cap || 'plastic', [x, y + (o.up ? 0.005 : -0.005), z + 0.009], [0.018, 0.016, 0.005], { rot: [o.up ? -0.25 : 0.25, 0, 0], bev: 0.001 }); if (o.led) led(F, [x, y + 0.021, z], o.led, o.pat || '', 0.006); };
  const knob = (F, c, r = 0.02, o = {}) => {
    const [x, y, z = 0] = c, a = o.a || 0;
    cyl(F, 'steel', [x, y, z + 0.003], r * 1.22, 0.006, { axis: 'z', seg: 16 });
    cyl(F, o.mat || 'darkMetal', [x, y, z + 0.0115], r, 0.011, { axis: 'z', seg: 16 });
    box(F, o.mark || 'paintWhite', [x - Math.sin(a) * r * 0.55, y + Math.cos(a) * r * 0.55, z + 0.0175], [0.0032, r * 0.8, 0.002], { rot: [0, 0, a], bev: 0 });
  };
  const vent = (F, c, w, h, n = 6, o = {}) => {
    const [x, y, z = 0] = c;
    box(F, 'plasticDark', [x, y, z + 0.002], [w, h, 0.004], { bev: 0.001 });
    for (let i = 0; i < n; i++) box(F, o.mat || 'trim', [x, y - h / 2 + (i + 0.5) * h / n, z + 0.006], [w * 0.9, h / n * 0.46, 0.006], { rot: [-0.45, 0, 0], bev: 0 });
  };
  const _q1 = new THREE.PlaneGeometry(1, 1);       // screw heads are single quads (a 4.5 mm cylinder is never resolved, saves ~5k triangles)
  const screw = (F, c, r = 0.0045) => kit.add('steel', _q1, { matrix: at(F, [c[0], c[1], (c[2] || 0) + 0.0025], { scale: [r * 2, r * 2, 1] }) });
  const screws4 = (F, cx, cy, w, h, z = 0) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) screw(F, [cx + sx * w / 2, cy + sy * h / 2, z]); };
  const gauge = (F, c, r = 0.04, a = 0.5, o = {}) => {
    const [x, y, z = 0] = c;
    cyl(F, 'darkMetal', [x, y, z + 0.006], r * 1.18, 0.012, { axis: 'z', seg: 20 }); cyl(F, 'screenOff', [x, y, z + 0.0125], r * 0.95, 0.002, { axis: 'z', seg: 20 });
    torus(F, kit.eur ? 'trim' : o.ring || 'emitCyan', [x, y, z + 0.0135], r * 0.8, 0.0017, { seg: 24, tube: 4 });
    box(F, kit.eur ? 'trim' : o.needle || 'emitAmber', [x - Math.sin(a) * r * 0.32, y + Math.cos(a) * r * 0.32, z + 0.0145], [0.003, r * 0.66, 0.002], { rot: [0, 0, a], bev: 0 });
  };
  return { frame, at, box, cyl, sph, torus, tube, beam, sign, ribbon, dashPt, dashFrame, diag, aft, led, tile, toggle, rocker, knob, vent, screw, screws4, gauge, ID, lerp, V3, M4 };
}
