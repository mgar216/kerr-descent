// ORPHEUS · Elysium POI helpers — kit-bash accumulator (merge by material, vertex-coloured), parametric surfaces, weathering, canvas bits.
// Shared by poi_elysium.js and the per-slot builders (camp / lander / sensor / crystals). Everything is ship space, absolute coordinates.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './poi_common.js';

const PI = Math.PI;
export const TAU = PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const frac = (x) => x - Math.floor(x);

const _c = new THREE.Color(), _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _qr = new THREE.Quaternion(),
  _e = new THREE.Euler(), _s = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** hex / css colour / [r,g,b] (already linear) → linear [r,g,b] */
export function rgb(c) { if (Array.isArray(c)) return c; _c.set(c); return [_c.r, _c.g, _c.b]; }

// ─────────────────────────────── slot frame ───────────────────────────────
/** slot-local helper: x right / z toward the ship (the way the player arrives). local yaw 0 = slot.yaw in the world. */
export function slotFrame(env, slot) {
  const c = Math.cos(slot.yaw), s = Math.sin(slot.yaw);
  const L = {
    slot, yaw: slot.yaw, gy0: env.groundY(slot.x, slot.z),
    xz: (lx, lz) => [slot.x + lx * c + lz * s, slot.z - lx * s + lz * c],
    gy: (lx, lz) => { const [x, z] = L.xz(lx, lz); return env.groundY(x, z); },
    pos: (lx, h, lz) => { const [x, z] = L.xz(lx, lz); return new THREE.Vector3(x, env.groundY(x, z) + h, z); },
    dir: (lx, lz) => [lx * c + lz * s, -lx * s + lz * c],
    /** local XZ of a world XZ */
    local: (x, z) => { const dx = x - slot.x, dz = z - slot.z; return [dx * c - dz * s, dx * s + dz * c]; },
    /** slot-local direction of a world XZ direction vector (no translation) */
    ldir: (dx, dz) => [dx * c - dz * s, dx * s + dz * c],
  };
  return L;
}

// ─────────────────────────────── weathering ───────────────────────────────
const DUST = [0.20, 0.23, 0.31], FROST = [0.62, 0.72, 0.86];
/** vertex-colour weathering in WORLD space: dust + ground occlusion near the floor, frost on up-facing surfaces. HDR (>1) vertices are untouched. */
export function weather(geo, gy, o = {}) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, col = geo.attributes.color;
  const dust = o.dust ?? 0.24, frost = o.frost ?? 0.20, ao = o.ao ?? 0.32, dh = o.dustH ?? 0.9, aoH = o.aoH ?? 0.32;
  for (let i = 0, n = pos.count; i < n; i++) {
    let r = col.getX(i), g = col.getY(i), b = col.getZ(i);
    if (r > 1.05 || g > 1.05 || b > 1.05) continue;
    const h = Math.max(pos.getY(i) - gy, 0), ny = nor.getY(i);
    const sh = 1 - ao * Math.exp(-h / aoH) * (1 - Math.max(ny, 0) * 0.6);
    r *= sh; g *= sh; b *= sh;
    const kd = dust * Math.exp(-h / dh);
    r += (DUST[0] - r) * kd; g += (DUST[1] - g) * kd; b += (DUST[2] - b) * kd;
    const kf = frost * smooth(0.42, 0.96, ny);
    r += (FROST[0] - r) * kf; g += (FROST[1] - g) * kf; b += (FROST[2] - b) * kf;
    col.setXYZ(i, r, g, b);
  }
  col.needsUpdate = true;
  return geo;
}

// ─────────────────────────────── kit-bash accumulator ───────────────────────────────
class Bucket {
  constructor() { this.cap = 2048; this.icap = 4096; this.P = new Float32Array(this.cap * 3); this.N = new Float32Array(this.cap * 3); this.U = new Float32Array(this.cap * 2); this.C = new Float32Array(this.cap * 3); this.I = new Uint32Array(this.icap); this.nv = 0; this.ni = 0; }
  need(nv, ni) {
    if (this.nv + nv > this.cap) {
      let c = this.cap; while (this.nv + nv > c) c *= 2;
      const g = (a, n) => { const b = new Float32Array(n); b.set(a.subarray(0, this.nv * (a.length / this.cap))); return b; };
      this.P = g(this.P, c * 3); this.N = g(this.N, c * 3); this.U = g(this.U, c * 2); this.C = g(this.C, c * 3); this.cap = c;
    }
    if (this.ni + ni > this.icap) { let c = this.icap; while (this.ni + ni > c) c *= 2; const b = new Uint32Array(c); b.set(this.I.subarray(0, this.ni)); this.I = b; this.icap = c; }
  }
}
const FACES = [[1, 0, 0, 0, 0, -1, 0, 1, 0], [-1, 0, 0, 0, 0, 1, 0, 1, 0], [0, 1, 0, 1, 0, 0, 0, 0, -1], [0, -1, 0, 1, 0, 0, 0, 0, 1], [0, 0, 1, 1, 0, 0, 0, 1, 0], [0, 0, -1, -1, 0, 0, 0, 1, 0]];   // n, u(right), v(up) per face
const _nm3 = new THREE.Matrix3(), _qrod = new THREE.Quaternion();

/**
 * Collects primitives (prop-local coordinates → current frame → world), tints them with vertex colours, and accumulates them straight into per-bucket typed arrays
 * (no per-part BufferGeometry). Usage: kb.frame(x,y,z,yaw) ; kb.box('metal', w,h,d, [x,y,z], [rx,ry,rz], 0x808890) ; … ; kb.mesh('metal', material)
 */
export class Kb {
  constructor(seed = 1) { this.b = new Map(); this.F = new THREE.Matrix4(); this.rnd = mulberry32(seed); this.jit = 0.05; this.groundY = 0; this.env = null; this.L = null; this.nParts = 0; this._e = null; this._ne = null; this._fn = null; this._cr = 1; this._cg = 1; this._cb = 1; }
  bind(env, L) { this.env = env; this.L = L; this.groundY = L.gy0; return this; }
  /** absolute frame for subsequent parts (world translation + yaw/pitch/roll, order YXZ) */
  frame(x, y, z, yaw = 0, pitch = 0, roll = 0) { _e.set(pitch, yaw, roll, 'YXZ'); _q.setFromEuler(_e); this.F.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1)); return this; }
  /** frame at slot-local (lx, lz) on the terrain, optional local yaw / lift; returns world [x, z] */
  at(lx, lz, yaw = 0, lift = 0, pitch = 0, roll = 0) { const [x, z] = this.L.xz(lx, lz); this.frame(x, this.env.groundY(x, z) + lift, z, this.L.yaw + yaw, pitch, roll); return [x, z]; }
  /** identity frame (parts given directly in world space) */
  world() { this.F.identity(); return this; }
  /** push a prop-local sub frame (position, euler rotation) for the following parts; end() pops it */
  sub(p, r) { (this._st || (this._st = [])).push(this.F.clone()); _qr.setFromEuler(_e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, 'YXZ')); _l.compose(_p.set(p[0], p[1], p[2]), _qr, _s.set(1, 1, 1)); this.F.multiply(_l); return this; }
  end() { this.F.copy(this._st.pop()); return this; }

  /** set up transform (F · T·R·S) + colour state for the next primitive; returns its bucket */
  _begin(key, p, r, s, col) {
    if (r && r.isQuaternion) _qr.copy(r); else _qr.setFromEuler(_e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, 'YXZ'));
    if (typeof s === 'number') _s.set(s, s, s); else if (s) _s.set(s[0], s[1], s[2]); else _s.set(1, 1, 1);
    if (p) _p.set(p[0], p[1], p[2]); else _p.set(0, 0, 0);
    _l.compose(_p, _qr, _s); _m.multiplyMatrices(this.F, _l); this._e = _m.elements; this._ne = _nm3.getNormalMatrix(_m).elements;
    if (typeof col === 'function') this._fn = col;
    else { this._fn = null; const c = rgb(col ?? 0xffffff), hdr = c[0] > 1 || c[1] > 1 || c[2] > 1, j = hdr ? 1 : 1 + (this.rnd() - 0.5) * 2 * this.jit; this._cr = c[0] * j; this._cg = c[1] * j; this._cb = c[2] * j; }
    let bk = this.b.get(key); if (!bk) this.b.set(key, bk = new Bucket());
    this.nParts++; return bk;
  }
  _v(bk, x, y, z, nx, ny, nz, u, v) {
    const e = this._e, n = this._ne, i = bk.nv++, i3 = i * 3, P = bk.P, N = bk.N, C = bk.C;
    P[i3] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[i3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[i3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    const X = n[0] * nx + n[3] * ny + n[6] * nz, Y = n[1] * nx + n[4] * ny + n[7] * nz, Z = n[2] * nx + n[5] * ny + n[8] * nz, l = 1 / (Math.sqrt(X * X + Y * Y + Z * Z) || 1);
    N[i3] = X * l; N[i3 + 1] = Y * l; N[i3 + 2] = Z * l; bk.U[i * 2] = u; bk.U[i * 2 + 1] = v;
    if (this._fn) { const c = this._fn(x, y, z); C[i3] = c[0]; C[i3 + 1] = c[1]; C[i3 + 2] = c[2]; } else { C[i3] = this._cr; C[i3 + 1] = this._cg; C[i3 + 2] = this._cb; }
  }
  _tri(bk, a, b, c) { const I = bk.I, k = bk.ni; I[k] = a; I[k + 1] = b; I[k + 2] = c; bk.ni += 3; }

  /** generic path: append any THREE geometry (position/normal?/uv?/index?) */
  add(key, geo, p, r, s, col) {
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, uv = geo.attributes.uv ? geo.attributes.uv.array : null, n = geo.attributes.position.count;
    const idx = geo.index ? geo.index.array : null, ni = idx ? idx.length : n;
    const bk = this._begin(key, p, r, s, col); bk.need(n, ni);
    const base = bk.nv;
    for (let i = 0; i < n; i++) this._v(bk, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2], uv ? uv[i * 2] : 0, uv ? uv[i * 2 + 1] : 0);
    if (idx) for (let i = 0; i < ni; i++) bk.I[bk.ni++] = base + idx[i]; else for (let i = 0; i < n; i++) bk.I[bk.ni++] = base + i;
    return geo;
  }
  box(key, w, h, d, p, r, col) {
    const bk = this._begin(key, p, r, 1, col), hw = w / 2, hh = h / 2, hd = d / 2; bk.need(24, 36);
    for (let f = 0; f < 6; f++) {
      const q = FACES[f], base = bk.nv;
      for (let k = 0; k < 4; k++) {
        const su = k & 1 ? 1 : -1, sv = k < 2 ? 1 : -1;
        this._v(bk, hw * (q[0] + q[3] * su + q[6] * sv), hh * (q[1] + q[4] * su + q[7] * sv), hd * (q[2] + q[5] * su + q[8] * sv), q[0], q[1], q[2], k & 1, k < 2 ? 1 : 0);
      }
      this._tri(bk, base + 2, base + 3, base + 1); this._tri(bk, base + 2, base + 1, base);
    }
  }
  cyl(key, rt, rb, h, seg, p, r, col, open = false) {
    const bk = this._begin(key, p, r, 1, col), slope = (rb - rt) / h, hh = h / 2; bk.need((seg + 1) * 2 + (open ? 0 : (seg + 2) * 2), seg * 6 + (open ? 0 : seg * 6));
    const b0 = bk.nv;
    for (let i = 0; i <= seg; i++) { const th = i / seg * TAU, sn = Math.sin(th), cs = Math.cos(th); this._v(bk, rt * sn, hh, rt * cs, sn, slope, cs, i / seg, 1); this._v(bk, rb * sn, -hh, rb * cs, sn, slope, cs, i / seg, 0); }
    for (let i = 0; i < seg; i++) { const a = b0 + i * 2; this._tri(bk, a, a + 1, a + 3); this._tri(bk, a, a + 3, a + 2); }
    if (!open) for (const top of [true, false]) {
      const rr = top ? rt : rb, y = top ? hh : -hh, ny = top ? 1 : -1, c0 = bk.nv; if (rr <= 0) continue;
      this._v(bk, 0, y, 0, 0, ny, 0, 0.5, 0.5);
      for (let i = 0; i <= seg; i++) { const th = i / seg * TAU, sn = Math.sin(th), cs = Math.cos(th); this._v(bk, rr * sn, y, rr * cs, 0, ny, 0, sn * 0.5 + 0.5, cs * 0.5 * ny + 0.5); }
      for (let i = 0; i < seg; i++) { if (top) this._tri(bk, c0, c0 + 1 + i, c0 + 2 + i); else this._tri(bk, c0, c0 + 2 + i, c0 + 1 + i); }
    }
  }
  sph(key, rad, p, col, scale = 1, seg = [10, 7]) {
    const ws = seg[0], hs = seg[1], bk = this._begin(key, p, null, scale, col); bk.need((ws + 1) * (hs + 1), ws * hs * 6); const b0 = bk.nv;
    for (let iy = 0; iy <= hs; iy++) { const ph = iy / hs * PI, sp = Math.sin(ph), cp = Math.cos(ph); for (let ix = 0; ix <= ws; ix++) { const th = ix / ws * TAU, x = sp * Math.sin(th), z = sp * Math.cos(th); this._v(bk, rad * x, rad * cp, rad * z, x, cp, z, ix / ws, 1 - iy / hs); } }
    for (let iy = 0; iy < hs; iy++) for (let ix = 0; ix < ws; ix++) { const a = b0 + iy * (ws + 1) + ix, c = a + ws + 1; this._tri(bk, a, c, a + 1); this._tri(bk, a + 1, c, c + 1); }
  }
  torus(key, R, r, p, rot, col, arc = TAU, seg = [6, 18]) { return this.add(key, new THREE.TorusGeometry(R, r, seg[0], seg[1], arc), p, rot, 1, col); }
  plane(key, w, h, p, r, col) { return this.add(key, new THREE.PlaneGeometry(w, h), p, r, 1, col); }
  /** cylinder between two prop-local points (a → b), radius r0 at a, r1 at b */
  rod(key, a, b, r0, r1 = r0, col, seg = 6, open = false) {
    _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]); _b.sub(_a); const len = _b.length(); if (len < 1e-6) return null;
    _qrod.setFromUnitVectors(_up, _b.multiplyScalar(1 / len));
    return this.cyl(key, r1, r0, len, seg, [(a[0] + _b.x * len / 2 + 0), (a[1] + _b.y * len / 2), (a[2] + _b.z * len / 2)], _qrod, col, open);
  }
  /** smooth tube along prop-local points (uniform Catmull-Rom through them, parallel-transport frames) */
  tube(key, pts, rad, col, tseg = 12, rseg = 4, closed = false) {
    const n = pts.length, bk = this._begin(key, null, null, 1, col), rs = rseg + 1; bk.need((tseg + 1) * rs, tseg * rseg * 6);
    const pt = (i) => pts[closed ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i))];
    const cx = [], tg = [];
    const segs = closed ? n : n - 1;
    for (let s = 0; s <= tseg; s++) {
      const t = s / tseg * segs, i = Math.min(Math.floor(t), segs - 1), f = t - i, p0 = pt(i - 1), p1 = pt(i), p2 = pt(i + 1), p3 = pt(i + 2), f2 = f * f, f3 = f2 * f, c = [0, 0, 0];
      for (let k = 0; k < 3; k++) c[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3);
      cx.push(c);
    }
    for (let s = 0; s <= tseg; s++) { const a = cx[Math.max(0, s - 1)], b = cx[Math.min(tseg, s + 1)]; let x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2]; const l = Math.sqrt(x * x + y * y + z * z) || 1; tg.push([x / l, y / l, z / l]); }
    let nx, ny, nz; { const t0 = tg[0]; if (Math.abs(t0[1]) < 0.9) { nx = -t0[2]; ny = 0; nz = t0[0]; } else { nx = 1; ny = 0; nz = 0; } const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l; }
    const b0 = bk.nv;
    for (let s = 0; s <= tseg; s++) {
      const t = tg[s], d = nx * t[0] + ny * t[1] + nz * t[2]; nx -= d * t[0]; ny -= d * t[1]; nz -= d * t[2]; const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
      const bx = t[1] * nz - t[2] * ny, by = t[2] * nx - t[0] * nz, bz = t[0] * ny - t[1] * nx, c = cx[s];
      for (let j = 0; j <= rseg; j++) { const a = j / rseg * TAU, ca = Math.cos(a), sa = Math.sin(a), ox = nx * ca + bx * sa, oy = ny * ca + by * sa, oz = nz * ca + bz * sa; this._v(bk, c[0] + ox * rad, c[1] + oy * rad, c[2] + oz * rad, ox, oy, oz, j / rseg, s / tseg); }
    }
    for (let s = 0; s < tseg; s++) for (let j = 0; j < rseg; j++) { const a = b0 + s * rs + j, b = a + rs; this._tri(bk, a, a + 1, b); this._tri(bk, a + 1, b + 1, b); }
  }
  /** parabolic dish shell (both faces lit correctly); opening faces +Y of the part frame. R radius, depth rise at the rim */
  dish(key, R, depth, p, r, col, seg = 20, rings = 4) {
    const mk = () => surface(seg, rings, (u, v, o) => { const a = u * TAU, q = v * R; o[0] = q * Math.cos(a); o[1] = depth * v * v; o[2] = q * Math.sin(a); }, { wrapU: true, pole0: true });
    const a = mk(), b = mk(), idx = b.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    const nr = b.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
    this.add(key, a, p, r, 1, col); this.add(key, b, p, r, 1, col);
  }
  mesh(key, material, o = {}) {
    const bk = this.b.get(key); if (!bk || !bk.nv) return null;
    const geo = new THREE.BufferGeometry(), nv = bk.nv;
    geo.setAttribute('position', new THREE.BufferAttribute(bk.P.slice(0, nv * 3), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(bk.N.slice(0, nv * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(bk.U.slice(0, nv * 2), 2)); geo.setAttribute('color', new THREE.BufferAttribute(bk.C.slice(0, nv * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(nv > 65535 ? bk.I.slice(0, bk.ni) : Uint16Array.from(bk.I.subarray(0, bk.ni)), 1));
    if (o.weather !== false) weather(geo, o.groundY ?? this.groundY, o.weather || {});
    const m = new THREE.Mesh(geo, material);
    m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true; m.name = o.name || key;
    m.matrixAutoUpdate = false; m.updateMatrix();
    this.b.delete(key);
    return m;
  }
}

// ─────────────────────────────── parametric surface ───────────────────────────────
/**
 * Grid surface p(u,v) with u,v ∈ [0,1]. o: { uv:[su,sv], uvfn(u,v,out2), skip(uc,vc)→bool, wrapU, closeV0, closeV1 }.
 * Winding is auto-oriented so that normals point away from the surface centroid. Smooth normals (wrapU welds the seam).
 */
export function surface(nu, nv, fn, o = {}) {
  const w = nu + 1, N = w * (nv + 1), P = new Float32Array(N * 3), UV = new Float32Array(N * 2), t = [0, 0, 0], uvs = o.uv || [1, 1];
  let cx = 0, cy = 0, cz = 0;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const k = j * w + i, u = i / nu, v = j / nv;
    fn(u, v, t); P[k * 3] = t[0]; P[k * 3 + 1] = t[1]; P[k * 3 + 2] = t[2]; cx += t[0]; cy += t[1]; cz += t[2];
    if (o.uvfn) { o.uvfn(u, v, t); UV[k * 2] = t[0]; UV[k * 2 + 1] = t[1]; } else { UV[k * 2] = u * uvs[0]; UV[k * 2 + 1] = v * uvs[1]; }
  }
  cx /= N; cy /= N; cz /= N;
  const idx = []; let score = 0;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if (o.skip && o.skip((i + 0.5) / nu, (j + 0.5) / nv)) continue;
    const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
    idx.push(a, c, b, b, c, d);
    // orientation probe on triangle (a,c,b)
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[c * 3] - ax, uy = P[c * 3 + 1] - ay, uz = P[c * 3 + 2] - az, vx = P[b * 3] - ax, vy = P[b * 3 + 1] - ay, vz = P[b * 3 + 2] - az;
    score += (uy * vz - uz * vy) * (ax - cx) + (uz * vx - ux * vz) * (ay - cy) + (ux * vy - uy * vx) * (az - cz);
  }
  if (score < 0) for (let i = 0; i < idx.length; i += 3) { const x = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = x; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  if (o.wrapU) for (let j = 0; j <= nv; j++) { const a = j * w, b = a + nu; const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1; nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l); }
  if (o.pole1) { let x = 0, y = 0, z = 0; for (let i = 0; i <= nu; i++) { const k = nv * w + i; x += nr.getX(k); y += nr.getY(k); z += nr.getZ(k); } const l = Math.hypot(x, y, z) || 1; for (let i = 0; i <= nu; i++) nr.setXYZ(nv * w + i, x / l, y / l, z / l); }
  if (o.pole0) { let x = 0, y = 0, z = 0; for (let i = 0; i <= nu; i++) { x += nr.getX(i); y += nr.getY(i); z += nr.getZ(i); } const l = Math.hypot(x, y, z) || 1; for (let i = 0; i <= nu; i++) nr.setXYZ(i, x / l, y / l, z / l); }
  return g;
}

/** remap box UVs per face into atlas rects. rects: [px,nx,py,ny,pz,nz] each [u0,v0,u1,v1] (v up) or null for "dead pixel" (rects.dead) */
export function boxFaceUV(geo, rects, dead = [0.004, 0.004, 0.012, 0.012]) {
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const r = rects[f] || dead;
    for (let k = 0; k < 4; k++) { const i = f * 4 + k, u = uv.getX(i), v = uv.getY(i); uv.setXY(i, r[0] + u * (r[2] - r[0]), r[1] + v * (r[3] - r[1])); }
  }
  uv.needsUpdate = true;
  return geo;
}

// ─────────────────────────────── canvas bits ───────────────────────────────
export const HAND = '"Segoe Print",cursive';
export const SANS = '"Segoe UI",Arial,sans-serif';
export const MONO = SANS;   // one UI family everywhere keeps first-use font loading to a minimum (recorders already pull in Segoe UI)
let _scratch = null;

/** stencil lettering: text drawn on a scratch layer with bridge gaps punched through it, then composited (safe on opaque canvases) */
export function stencilText(g, text, x, y, size, color, o = {}) {
  const font = o.font || `bold ${size}px ${SANS}`, ls = o.spacing && 'letterSpacing' in g ? `${o.spacing}px` : null;
  g.save(); g.font = font; if (ls) g.letterSpacing = ls;
  const w = Math.ceil(g.measureText(text).width) + 8, h = Math.ceil(size * 1.4);
  if (!_scratch) _scratch = document.createElement('canvas');
  const c = _scratch; c.width = w; c.height = h;   // (resizing also clears)
  const t = c.getContext('2d'); t.font = font; if (ls) t.letterSpacing = ls;
  t.textBaseline = 'middle'; t.textAlign = 'center'; t.fillStyle = color; t.fillText(text, w / 2, h / 2);
  t.globalCompositeOperation = 'destination-out';
  const gap = Math.max(1, size * 0.045);
  t.fillRect(0, h / 2 - size * 0.1 - gap / 2, w, gap);                       // horizontal bridge
  for (let i = 0; i < text.length; i++) { const px = 4 + (w - 8) * (i + 0.5) / text.length; t.fillRect(px - gap / 2, h / 2 - size * 0.52, gap, size * 0.2); t.fillRect(px - gap / 2, h / 2 + size * 0.28, gap, size * 0.2); }
  const ax = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2;
  g.drawImage(c, ax, y - h / 2);
  g.restore();
}

/** radial soft glow (alpha) texture for additive ground decals */
export function glowTexture(kit, size = 128, stops = [[0, 1], [0.35, 0.45], [0.7, 0.12], [1, 0]]) {
  return kit.canvasTexture(size, size, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [s, a] of stops) gr.addColorStop(s, `rgba(255,255,255,${a})`);
    g.clearRect(0, 0, w, h); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { wrap: false, aniso: 2 });
}

/** one flat additive decal quad lying on the ground (world space), tinted by an (HDR) vertex colour; merged by the caller */
export function decalQuad(env, cx, cz, rx, rz, yaw, lift, col, steps = 3) {
  // heightfield-following grid so the decal hugs the ground
  const geo = new THREE.PlaneGeometry(1, 1, steps, steps), p = geo.attributes.position, c = Math.cos(yaw), s = Math.sin(yaw), n = p.count, ca = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const lx = p.getX(i) * 2 * rx, lz = -p.getY(i) * 2 * rz, x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
    p.setXYZ(i, x, env.groundY(x, z) + lift, z); ca[i * 3] = col[0]; ca[i * 3 + 1] = col[1]; ca[i * 3 + 2] = col[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(ca, 3));
  // (x,y) → (lx, lz=-y) is the −90° rotation about X: winding is preserved, the quad faces up
  geo.computeVertexNormals();
  return geo;
}

/** merge a list of decal geometries (position/normal/uv/color) */
export function mergeDecals(list) { return list.length ? (list.length === 1 ? list[0] : mergeGeometries(list, false)) : null; }

/** shared material helpers */
export function glowMat(kit, o = {}) { return kit.glow(0xffffff, 1, { vertexColors: true, toneMapped: true, ...o }); }
export function decalMat(tex, o = {}) {
  return new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: true, ...o });
}

/** standard vertex-coloured materials used by every Elysium slot (each slot makes its own set; disposeTree cleans them) */
export function baseMats(kit) {
  return {
    metal: kit.std({ color: 0xffffff, metalness: 0.55, roughness: 0.42, vertexColors: true, emissive: 0x141c2e }),     // tiny emissive lift = glow/galaxy bounce, keeps shadow sides readable
    paint: kit.std({ color: 0xffffff, metalness: 0.06, roughness: 0.64, vertexColors: true, emissive: 0x141c2e }),
    glow: glowMat(kit),
  };
}

// ─────────────────────────────── field-recorder tuning (kit.recorder) ───────────────────────────────
/** replace the recorder's little screen: draw(g, w, h) paints a 256×96 canvas */
export function recorderScreen(kit, rec, draw, gain) {
  const scr = rec.children.find((c) => c.isMesh && c.geometry?.type === 'PlaneGeometry' && c.material?.map);
  if (!scr) return;
  const old = scr.material.map; scr.material.map = kit.canvasTexture(256, 96, draw, { wrap: false, aniso: 4 }); old?.dispose();
  if (gain) scr.material.color.setScalar(gain);
}
/** remove the tripod (recorder lying on a table) */
export function recorderNoLegs(rec) {
  for (const c of [...rec.children]) if (c.isMesh && c.geometry?.type === 'CylinderGeometry' && c.geometry.parameters.height === 0.62) { rec.remove(c); c.geometry.dispose(); }
}
/** re-tint the stock recorder: case body + bumper colours (hex) so it reads against the dark ground */
export function recorderStyle(rec, body, bumper) {
  const near = (a, b) => Math.abs((a >> 16 & 255) - (b >> 16 & 255)) + Math.abs((a >> 8 & 255) - (b >> 8 & 255)) + Math.abs((a & 255) - (b & 255)) < 8;
  rec.traverse((m) => { if (!m.isMesh || !m.material?.color) return; const h = m.material.color.getHex(); if (near(h, 0x2b2f34)) m.material.color.set(body); else if (near(h, 0x14161a)) m.material.color.set(bumper); });
  return rec;
}
/** merge a recorder's meshes that share a material (11 draw calls → ~7); keeps materials (LED animation keeps working) */
export function consolidate(rec) {
  const by = new Map();
  for (const c of rec.children) if (c.isMesh && !Array.isArray(c.material)) { let l = by.get(c.material); if (!l) by.set(c.material, l = []); l.push(c); }
  for (const [mat, list] of by) {
    if (list.length < 2) continue;
    const geos = list.map((m) => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = list.some((m) => m.castShadow);
    for (const m of list) { rec.remove(m); m.geometry.dispose(); }
    rec.add(mesh);
  }
  return rec;
}

/** boot prints along slot-local polylines [{pts:[[lx,lz]…], s:±1 first foot, stride}] → one alpha-mapped quad geometry (toe-up print texture, mirrored for the left foot) */
export function printsGeo(env, L, paths, rr) {
  const P = [], U = [], I = []; let vi = 0;
  for (const path of paths) {
    let side = path.s || 1, carry = 0.2; const stride = path.stride || 0.62;
    for (let s = 0; s < path.pts.length - 1; s++) {
      const [ax, az] = path.pts[s], [bx, bz] = path.pts[s + 1], dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz); if (len < 1e-4) continue;
      const ux = dx / len, uz = dz / len, [fx, fz] = L.dir(ux, uz), ha = Math.atan2(fx, fz);
      let d = carry;
      for (; d < len; d += stride) {
        const a = ha + (rr() - 0.5) * 0.22 + side * 0.07, sx = Math.sin(a), sz = Math.cos(a), rx = sz, rz = -sx;
        const [cx, cz] = L.xz(ax + ux * d, az + uz * d), px = cx + Math.cos(ha) * 0.11 * side, pz = cz - Math.sin(ha) * 0.11 * side;
        const hw = 0.075, hl = 0.17;
        for (const [ox, oz, u, v] of [[-hw, -hl, 0, 0], [-hw, hl, 0, 1], [hw, hl, 1, 1], [hw, -hl, 1, 0]]) {
          const x = px + rx * ox + sx * oz, z = pz + rz * ox + sz * oz; P.push(x, env.groundY(x, z) + 0.016, z); U.push(side > 0 ? u : 1 - u, v);
        }
        I.push(vi, vi + 1, vi + 3, vi + 1, vi + 2, vi + 3); vi += 4; side = -side;
      }
      carry = d - len;
    }
  }
  if (!vi) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  g.computeVertexNormals();
  return g;
}
