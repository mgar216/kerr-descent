// ORPHEUS · asphodel POIs — shared helpers: noise, direct-emit part buckets (one merged mesh per material), textures, materials, wind, flag.
// Used by poi_asphodel.js and poi_asphodel_{outpost,mast,drone,pools}.js. Every slot builds in a LOCAL frame (origin = slot centre on the
// ground, +Z toward the ship) and parents the result into a child Group carrying position/yaw — the root POI group is never offset.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ───────────────────────────── noise ─────────────────────────────
function h2(x, y, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function h3(x, y, z, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** value noise 0..1 */
export function noise2(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm2(x, y, oct = 4, s = 0) { let sum = 0, amp = 0.5, tot = 0; for (let i = 0; i < oct; i++) { sum += amp * noise2(x, y, s + i * 17); tot += amp; x = x * 2.02 + 7.3; y = y * 2.02 - 3.1; amp *= 0.5; } return sum / tot; }
export function noise3(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h3(ix, iy, iz, s), h3(ix + 1, iy, iz, s), u), l(h3(ix, iy + 1, iz, s), h3(ix + 1, iy + 1, iz, s), u), v),
           l(l(h3(ix, iy, iz + 1, s), h3(ix + 1, iy, iz + 1, s), u), l(h3(ix, iy + 1, iz + 1, s), h3(ix + 1, iy + 1, iz + 1, s), u), v), w);
}
export function fbm3(x, y, z, oct = 3, s = 0) { let sum = 0, amp = 0.5, tot = 0; for (let i = 0; i < oct; i++) { sum += amp * noise3(x, y, z, s + i * 13); tot += amp; x = x * 2.03 + 5.1; y = y * 2.03 - 2.7; z = z * 2.03 + 8.9; amp *= 0.5; } return sum / tot; }

// ───────────────────────────── transforms / colour / loose geometry ─────────────────────────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
const UVS = 1 / 2.4;   // paint tile: 2.4 m

/** position / euler(YXZ) rotation / scale applied to a geometry in place; returns it */
export function xf(g, pos, rot, sc) {
  pos = pos || [0, 0, 0]; rot = rot || [0, 0, 0]; if (sc == null) sc = 1;
  _e.set(rot[0], rot[1], rot[2], 'YXZ'); _q.setFromEuler(_e);
  const s = typeof sc === 'number' ? [sc, sc, sc] : sc;
  _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(s[0], s[1], s[2])); g.applyMatrix4(_m); return g;
}
export function toColor(c, out = _c) { if (c && c.isColor) return out.copy(c); if (Array.isArray(c)) return out.setRGB(c[0], c[1], c[2]); return out.set(c); }
export function latheG(pts, seg = 16, pos, rot, sc) { return xf(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg), pos, rot, sc); }
/** smooth tube through points (hoses, cables) */
export function tubeG(pts, r, tubular = 16, radial = 5) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.4);
  return new THREE.TubeGeometry(curve, tubular, r, radial, false);
}
const _rockBase = new Map();   // detail → { pos, index } of the welded unit icosphere (mergeVertices is the slow part; do it once)
function rockBase(det) {
  let b = _rockBase.get(det);
  if (!b) { let g = new THREE.IcosahedronGeometry(1, det); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4); b = { pos: g.attributes.position.array.slice(), index: g.index.array.slice() }; g.dispose(); _rockBase.set(det, b); }
  return b;
}
/** displaced icosphere → lumpy rounded rock (position/normal/uv, indexed). flat > 0 squashes the bottom */
export function rockG(seed, o = {}) {
  const det = o.detail ?? 2, rough = o.rough ?? 0.28, sx = o.sx ?? 1, sy = o.sy ?? 0.7, sz = o.sz ?? 1, base = rockBase(det);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(base.pos.slice(), 3)); g.setIndex(new THREE.BufferAttribute(base.index.slice(), 1));
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = fbm3(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6 - seed * 0.7, 3, seed | 0) - 0.5, n2 = noise3(v.x * 5 + seed, v.y * 5, v.z * 5, 3) - 0.5;
    const rr = 1 + rough * 2 * n + rough * 0.35 * n2;
    let y = v.y * rr * sy; if (y < 0 && o.flat) y *= 1 - o.flat;
    p.setXYZ(i, v.x * rr * sx, y, v.z * rr * sz);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) { uv[i * 2] = p.getZ(i); uv[i * 2 + 1] = p.getY(i); } else if (ay >= az) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); } else { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getY(i); }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return o.pos || o.rot || o.sc ? xf(g, o.pos, o.rot, o.sc) : g;
}
/** quad geometry from 4 corners a(0,0) b(1,0) c(0,1) d(1,1) — normal = (b−a)×(c−a) */
export function quadG(a, b, c, d) {
  const g = new THREE.BufferGeometry(), A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), C = new THREE.Vector3(...c);
  const n = B.clone().sub(A).cross(C.clone().sub(A)).normalize();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2)); g.setIndex([0, 1, 2, 1, 3, 2]); return g;
}

// ───────────────────────────── part buckets: direct-emit primitives, one merged mesh per key ─────────────────────────────
const FACES = [   // [n, u, v] with u × v = n ; corners CCW seen from outside
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
];
export class Parts {
  /** extras: [{name, size}] extra float attributes carried by every vertex of this Parts (zeros for emitted primitives) */
  constructor({ rgba = false, extras = [] } = {}) {
    this.b = Object.create(null); this.rgba = rgba; this.extras = extras; this.cs = rgba ? 4 : 3;
    this._mat = new Float64Array(9); this._t = [0, 0, 0]; this._c = [1, 1, 1];
  }
  _bk(key) { return this.b[key] || (this.b[key] = { pos: [], nor: [], uv: [], col: [], idx: [], n: 0, ex: this.extras.map(() => []) }); }
  has(key) { return !!this.b[key]?.n; }
  _col(c) { const k = this._c; if (c === undefined) { k[0] = k[1] = k[2] = 1; } else { toColor(c); k[0] = _c.r; k[1] = _c.g; k[2] = _c.b; } return k; }
  _set(pos, rot) {
    const t = this._t, m = this._mat; t[0] = pos ? pos[0] : 0; t[1] = pos ? pos[1] : 0; t[2] = pos ? pos[2] : 0;
    if (rot && (rot[0] || rot[1] || rot[2])) { _e.set(rot[0], rot[1], rot[2], 'YXZ'); _q.setFromEuler(_e); _m.makeRotationFromQuaternion(_q); const e = _m.elements; m[0] = e[0]; m[1] = e[4]; m[2] = e[8]; m[3] = e[1]; m[4] = e[5]; m[5] = e[9]; m[6] = e[2]; m[7] = e[6]; m[8] = e[10]; }
    else { m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0; m[4] = 1; m[5] = 0; m[6] = 0; m[7] = 0; m[8] = 1; }
  }
  _v(bk, x, y, z, nx, ny, nz, u, v) {
    const m = this._mat, t = this._t, c = this._c;
    bk.pos.push(m[0] * x + m[1] * y + m[2] * z + t[0], m[3] * x + m[4] * y + m[5] * z + t[1], m[6] * x + m[7] * y + m[8] * z + t[2]);
    bk.nor.push(m[0] * nx + m[1] * ny + m[2] * nz, m[3] * nx + m[4] * ny + m[5] * nz, m[6] * nx + m[7] * ny + m[8] * nz);
    bk.uv.push(u, v); bk.col.push(c[0], c[1], c[2]); if (this.rgba) bk.col.push(this._a ?? 1);
    for (let k = 0; k < bk.ex.length; k++) for (let j = 0; j < this.extras[k].size; j++) bk.ex[k].push(0);
    return bk.n++;
  }
  /** append an existing geometry (position/normal/uv[/color]) — uniform `color` overrides its own colour attribute */
  add(key, g, color, alpha = 1) {
    if (!g) return this;
    const bk = this._bk(key), P = g.attributes.position, pa = P.array, n = P.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    const na = g.attributes.normal.array, U = g.attributes.uv, ua = U ? U.array : null, own = color === undefined && g.attributes.color ? g.attributes.color : null;
    const k = this._col(color), cs = this.cs, base = bk.n;
    for (let i = 0; i < n; i++) {
      bk.pos.push(pa[i * 3], pa[i * 3 + 1], pa[i * 3 + 2]); bk.nor.push(na[i * 3], na[i * 3 + 1], na[i * 3 + 2]); bk.uv.push(ua ? ua[i * 2] : 0, ua ? ua[i * 2 + 1] : 0);
      if (own) { const o = own.array, s = own.itemSize; bk.col.push(o[i * s], o[i * s + 1], o[i * s + 2]); if (cs === 4) bk.col.push(s === 4 ? o[i * s + 3] : 1); } else { bk.col.push(k[0], k[1], k[2]); if (cs === 4) bk.col.push(alpha); }
      for (let e = 0; e < bk.ex.length; e++) { const a = g.attributes[this.extras[e].name], sz = this.extras[e].size; for (let j = 0; j < sz; j++) bk.ex[e].push(a ? a.array[i * sz + j] : 0); }
    }
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) bk.idx.push(ia[i] + base); } else for (let i = 0; i < n; i++) bk.idx.push(base + i);
    bk.n += n; return this;
  }
  _quad(bk, a, b, c, d) { bk.idx.push(a, b, c, b, d, c); }
  /** axis-aligned box (local) rotated/translated: metric UV, flat normals */
  box(key, w, h, d, pos, rot, color, o) {
    const bk = this._bk(key); this._col(color); this._set(pos, rot);
    const H = [w / 2, h / 2, d / 2], uvS = o?.uv ?? UVS, p = pos || [0, 0, 0], ou = (p[0] * 0.37 + p[2] * 0.53) % 1, ov = (p[1] * 0.41 + p[2] * 0.29) % 1;
    for (const [n, u, v] of FACES) {
      const hu = Math.abs(u[0] * H[0] + u[1] * H[1] + u[2] * H[2]), hv = Math.abs(v[0] * H[0] + v[1] * H[1] + v[2] * H[2]), hn = Math.abs(n[0] * H[0] + n[1] * H[1] + n[2] * H[2]), base = bk.n;
      for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const a = su * hu, b = sv * hv;
        this._v(bk, n[0] * hn + u[0] * a + v[0] * b, n[1] * hn + u[1] * a + v[1] * b, n[2] * hn + u[2] * a + v[2] * b, n[0], n[1], n[2], (a + hu) * uvS + ou, (b + hv) * uvS + ov);
      }
      this._quad(bk, base, base + 1, base + 2, base + 3);
    }
    return this;
  }
  /** rounded / chamfered box (metric UV). small boxes fall back to a plain box */
  bev(key, w, h, d, pos, rot, r = 0.02, color) {
    if (r < 0.012 || Math.max(w, h, d) <= 0.34) return this.box(key, w, h, d, pos, rot, color);
    return this.rbox(key, w, h, d, r, { seg: 1, pos, rot }, color);
  }
  /** rounded box: r = edge radius, seg = arc segments, nx/ny/nz = middle subdivisions; o: {pos, rot, uv, ou, ov} */
  rbox(key, w, h, d, r, o = {}, color) {
    const bk = this._bk(key); this._col(color); this._set(o.pos, o.rot);
    const seg = o.seg ?? 3, mid = [o.nx ?? 1, o.ny ?? 1, o.nz ?? 1], H = [w / 2, h / 2, d / 2], uvS = o.uv ?? UVS, ou = o.ou ?? 0, ov = o.ov ?? 0;
    r = Math.min(r, H[0], H[1], H[2]); const A = [H[0] - r, H[1] - r, H[2] - r];
    const coords = H.map((hh, k) => { const a = A[k], out = []; for (let i = 0; i <= seg; i++) out.push(-hh + r * i / seg); for (let j = 1; j < mid[k]; j++) out.push(-a + 2 * a * j / mid[k]); for (let i = 0; i <= seg; i++) out.push(a + r * i / seg); return out; });
    const faces = [[0, 1, 2, 1], [0, -1, 2, 1], [1, 1, 0, 2], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 0, 1]];
    const Pt = [0, 0, 0];
    for (const [ax, sg, ub, vc] of faces) {
      const cb = coords[ub], cc = coords[vc], base = bk.n, nb = cb.length;
      for (let j = 0; j < cc.length; j++) for (let i = 0; i < nb; i++) {
        Pt[ax] = sg * H[ax]; Pt[ub] = cb[i]; Pt[vc] = cc[j];
        const q0 = Math.max(-A[0], Math.min(A[0], Pt[0])), q1 = Math.max(-A[1], Math.min(A[1], Pt[1])), q2 = Math.max(-A[2], Math.min(A[2], Pt[2]));
        let dx = Pt[0] - q0, dy = Pt[1] - q1, dz = Pt[2] - q2; const len = Math.hypot(dx, dy, dz) || 1; dx /= len; dy /= len; dz /= len;
        this._v(bk, q0 + dx * r, q1 + dy * r, q2 + dz * r, dx, dy, dz, cb[i] * uvS + ou, cc[j] * uvS + ov);
      }
      const cyc = ((ub - ax + 3) % 3) === 1, flip = sg * (cyc ? 1 : -1) < 0;
      for (let j = 0; j < cc.length - 1; j++) for (let i = 0; i < nb - 1; i++) {
        const a = base + j * nb + i, b = a + 1, c = a + nb, dd = c + 1;
        if (flip) bk.idx.push(a, c, b, b, c, dd); else bk.idx.push(a, b, c, b, dd, c);
      }
    }
    return this;
  }
  /** cylinder / cone about local Y (rt top radius, rb bottom radius), centred on pos; open = no caps */
  cyl(key, rt, rb, h, seg, pos, rot, color, open = false) {
    this._col(color); this._set(pos, rot); this._cylCore(this._bk(key), rt, rb, h, seg, open); return this;
  }
  _cylCore(bk, rt, rb, h, seg, open) {
    const hh = h / 2, sl = rb - rt, base = bk.n, ln = Math.hypot(h, sl) || 1, ny = sl / ln, nr = h / ln;
    for (let i = 0; i <= seg; i++) { const a = i / seg * TAU, sx = Math.sin(a), cz = Math.cos(a); this._v(bk, rt * sx, hh, rt * cz, sx * nr, ny, cz * nr, i / seg, 1); this._v(bk, rb * sx, -hh, rb * cz, sx * nr, ny, cz * nr, i / seg, 0); }
    for (let i = 0; i < seg; i++) { const a = base + i * 2, b = a + 1, c = a + 3, d = a + 2; bk.idx.push(a, b, d, b, c, d); }
    if (open) return;
    for (const [top, r, y] of [[true, rt, hh], [false, rb, -hh]]) {
      if (r <= 0) continue; const ny2 = top ? 1 : -1, ci = this._v(bk, 0, y, 0, 0, ny2, 0, 0.5, 0.5), r0 = bk.n;
      for (let i = 0; i <= seg; i++) { const a = i / seg * TAU; this._v(bk, r * Math.sin(a), y, r * Math.cos(a), 0, ny2, 0, 0.5 + Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.5); }
      for (let i = 0; i < seg; i++) { if (top) bk.idx.push(ci, r0 + i, r0 + i + 1); else bk.idx.push(ci, r0 + i + 1, r0 + i); }
    }
  }
  /** cylinder (or cone) between two points a → b (r at a-end bottom, r2 at b-end top) */
  between(key, a, b, r, seg = 5, color, r2) {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = _d.length(); if (L < 1e-6) return this;
    _q.setFromUnitVectors(_up, _d.multiplyScalar(1 / L)); _m.makeRotationFromQuaternion(_q); const e = _m.elements, m = this._mat, t = this._t;
    m[0] = e[0]; m[1] = e[4]; m[2] = e[8]; m[3] = e[1]; m[4] = e[5]; m[5] = e[9]; m[6] = e[2]; m[7] = e[6]; m[8] = e[10];
    t[0] = (a[0] + b[0]) / 2; t[1] = (a[1] + b[1]) / 2; t[2] = (a[2] + b[2]) / 2; this._col(color);
    this._cylCore(this._bk(key), r2 ?? r, r, L, seg, false); return this;
  }
  /** UV sphere / ellipsoid (sc = [sx,sy,sz]) */
  sph(key, r, ws, hs, pos, color, sc, rot) {
    const bk = this._bk(key); this._col(color); this._set(pos, rot); const s = sc || [1, 1, 1], base = bk.n;
    for (let iy = 0; iy <= hs; iy++) for (let ix = 0; ix <= ws; ix++) {
      const u = ix / ws, v = iy / hs, ph = u * TAU, th = v * Math.PI, x = -Math.cos(ph) * Math.sin(th), y = Math.cos(th), z = Math.sin(ph) * Math.sin(th);
      let nx = x / s[0], ny = y / s[1], nz = z / s[2]; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      this._v(bk, x * r * s[0], y * r * s[1], z * r * s[2], nx, ny, nz, u, 1 - v);
    }
    const w1 = ws + 1;
    for (let iy = 0; iy < hs; iy++) for (let ix = 0; ix < ws; ix++) {
      const a = base + iy * w1 + ix + 1, b = base + iy * w1 + ix, c = base + (iy + 1) * w1 + ix, d = base + (iy + 1) * w1 + ix + 1;
      if (iy !== 0) bk.idx.push(a, b, d); if (iy !== hs - 1) bk.idx.push(b, c, d);
    }
    return this;
  }
  /** straight pipe segments + ball elbows along a polyline */
  pipe(key, pts, r, seg = 6, color, elbow = 1.0) {
    for (let i = 0; i < pts.length - 1; i++) this.between(key, pts[i], pts[i + 1], r, seg, color);
    for (let i = 1; i < pts.length - 1; i++) this.sph(key, r * elbow, seg, 4, pts[i], color);
    return this;
  }
  /** rectangular frame (outer w×h, border t), `depth` along +Z, origin = back-face centre */
  frame(key, w, h, t, depth, pos, rot, color) {
    const p = pos || [0, 0, 0], ry = rot ? rot[1] : 0, rx = rot ? rot[0] : 0, rz = rot ? rot[2] : 0;
    const put = (ox, oy, bw, bh) => {   // offsets in the frame-local XY plane, rotated with the frame
      _e.set(rx, ry, rz, 'YXZ'); _p.set(ox, oy, depth / 2).applyEuler(_e);
      this.box(key, bw, bh, depth, [p[0] + _p.x, p[1] + _p.y, p[2] + _p.z], rot, color);
    };
    put(0, h / 2 - t / 2, w, t); put(0, -h / 2 + t / 2, w, t); put(-w / 2 + t / 2, 0, t, h - 2 * t); put(w / 2 - t / 2, 0, t, h - 2 * t); return this;
  }
  /** flat quad (a(0,0) b(1,0) c(0,1) d(1,1)) with an optional atlas region uvr = [u0,v0,u1,v1] */
  quad(key, a, b, c, d, color, uvr) {
    const bk = this._bk(key); this._col(color); this._set(null, null); const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), C = new THREE.Vector3(...c), n = B.sub(A).cross(C.sub(new THREE.Vector3(...a))).normalize();
    const [u0, v0, u1, v1] = uvr || [0, 0, 1, 1], base = bk.n;
    this._v(bk, a[0], a[1], a[2], n.x, n.y, n.z, u0, v0); this._v(bk, b[0], b[1], b[2], n.x, n.y, n.z, u1, v0); this._v(bk, c[0], c[1], c[2], n.x, n.y, n.z, u0, v1); this._v(bk, d[0], d[1], d[2], n.x, n.y, n.z, u1, v1);
    bk.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2); return this;
  }
  /** w×h plane facing local +Z, centred at pos, rotated by rot; atlas region (optionally mirrored in u) */
  decal(key, uvr, w, h, pos, rot, mirror = false, color) {
    const bk = this._bk(key); this._col(color); this._set(pos, rot); const [u0, v0, u1, v1] = uvr, a = mirror ? u1 : u0, b = mirror ? u0 : u1, base = bk.n, hw = w / 2, hh = h / 2;
    this._v(bk, -hw, hh, 0, 0, 0, 1, a, v1); this._v(bk, hw, hh, 0, 0, 0, 1, b, v1); this._v(bk, -hw, -hh, 0, 0, 0, 1, a, v0); this._v(bk, hw, -hh, 0, 0, 0, 1, b, v0);
    bk.idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3); return this;
  }
  /** vertical band following a rounded-rectangle plan outline (w × d, corner r, centred on pos) from y0..y1, `off` m proud of the surface */
  ring(key, w, d, r, y0, y1, off, pos, color, uvS = UVS) {
    const bk = this._bk(key); this._col(color); this._set(pos, null);
    const hx = w / 2 - r, hz = d / 2 - r, arc = 6, pts = [], corners = [[hx, hz, 0], [-hx, hz, Math.PI / 2], [-hx, -hz, Math.PI], [hx, -hz, Math.PI * 1.5]];
    for (const [cx, cz, t0] of corners) for (let i = 0; i <= arc; i++) { const t = t0 + (Math.PI / 2) * i / arc; pts.push([cx + Math.cos(t) * (r + off), cz + Math.sin(t) * (r + off), Math.cos(t), Math.sin(t)]); }
    pts.push(pts[0]); let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const [x, z, nx, nz] = pts[i]; this._v(bk, x, y0, z, nx, 0, nz, acc * uvS, y0 * uvS); this._v(bk, x, y1, z, nx, 0, nz, acc * uvS, y1 * uvS);
      if (i) { const a = bk.n - 4; bk.idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    return this;
  }
  merged(key) {
    const bk = this.b[key]; if (!bk?.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bk.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(bk.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(bk.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(bk.col, this.cs));
    this.extras.forEach((e, k) => g.setAttribute(e.name, new THREE.Float32BufferAttribute(bk.ex[k], e.size)));
    g.setIndex(new THREE.BufferAttribute(bk.n > 65535 ? new Uint32Array(bk.idx) : new Uint16Array(bk.idx), 1));
    delete this.b[key]; return g;
  }
  /** build a Mesh for `key` with `mat`; `post(geo)` may adjust vertex colours */
  mesh(key, mat, { cast = true, receive = true, post, name } = {}) {
    const g = this.merged(key); if (!g) return null;
    if (post) post(g);
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
  }
}

/** per-vertex colour multiplier: ground dust (toward `dust` below y0+height) + optional low-frequency variation; tight loop over the colour array */
export function weather(g, { strength = 0.4, height = 0.8, dust = [0.78, 0.75, 0.70], y0 = 0, vary = 0, varyScale = 0.45, topDark = 0 } = {}) {
  const pa = g.attributes.position.array, na = g.attributes.normal.array, ca = g.attributes.color.array, cs = g.attributes.color.itemSize, n = g.attributes.position.count;
  const lr = 1 - strength + strength * dust[0], lg = 1 - strength + strength * dust[1], lb = 1 - strength + strength * dust[2];
  for (let i = 0; i < n; i++) {
    const x = pa[i * 3], y = pa[i * 3 + 1], z = pa[i * 3 + 2]; let f = (y - y0) / height; f = f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f);
    let k = vary ? 1 - vary + vary * 2 * fbm2(x * varyScale + 3, z * varyScale + y * 0.6, 3, 3) : 1; if (topDark && na[i * 3 + 1] > 0.9) k *= 1 - topDark;
    ca[i * cs] *= (lr + (1 - lr) * f) * k; ca[i * cs + 1] *= (lg + (1 - lg) * f) * k; ca[i * cs + 2] *= (lb + (1 - lb) * f) * k;
  }
  g.attributes.color.needsUpdate = true; return g;
}

// ───────────────────────────── colliders ─────────────────────────────
/** local→world helper for a builder frame (origin x,y,z; yaw = rotation.y of the child group) */
export function frameOf(x, y, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x, y, z, yaw, /** local (lx,lz) → world [x,z] (rotation.y convention: x' = x c + z s, z' = −x s + z c) */ xz: (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c], ry: (a) => a + yaw };
}
/** axis-aligned boxes approximating a rotated rectangle (local centre lx,lz; half extents hx (local X), hz (local Z); extra local yaw ly), sliced into strips along the longer world axis */
export function rectBoxes(F, lx, lz, hx, hz, ly, y0, y1, step = 0.8) {
  const [cx, cz] = F.xz(lx, lz), th = F.yaw + ly, ux = Math.cos(th), uz = -Math.sin(th), vx = Math.sin(th), vz = Math.cos(th);
  const poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + a * hx * ux + b * hz * vx, cz + a * hx * uz + b * hz * vz]);
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const alongX = (maxX - minX) >= (maxZ - minZ), lo = alongX ? minX : minZ, hi = alongX ? maxX : maxZ, n = Math.max(1, Math.ceil((hi - lo) / step)), out = [];
  const clip = (pts, ax, v, keepGreater) => { const r = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], da = a[ax] - v, db = b[ax] - v, ia = keepGreater ? da >= 0 : da <= 0, ib = keepGreater ? db >= 0 : db <= 0; if (ia) r.push(a); if (ia !== ib) { const t = da / (da - db); r.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return r; };
  for (let i = 0; i < n; i++) {
    const a = lo + (hi - lo) * i / n, b = lo + (hi - lo) * (i + 1) / n, pts = clip(clip(poly, alongX ? 0 : 1, a, true), alongX ? 0 : 1, b, false);
    if (pts.length < 3) continue;
    const px = pts.map((p) => p[0]), pz = pts.map((p) => p[1]);
    out.push({ min: [Math.min(...px), y0, Math.min(...pz)], max: [Math.max(...px), y1, Math.max(...pz)] });
  }
  return out;
}

// ───────────────────────────── atlas / text helpers ─────────────────────────────
const FONT = 'Rajdhani, Bahnschrift, "Segoe UI", Arial, sans-serif';
/** [u0,v0,u1,v1] of region `key` in an atlas definition R (canvas px rects) */
export function atlasRegion(R, key, atlasW = 512, atlasH = 512) { const [x, y, w, h] = R[key]; return [x / atlasW, 1 - (y + h) / atlasH, (x + w) / atlasW, 1 - y / atlasH]; }
/** lettering centred (or o.align) at x,y; o.maxW shrinks the size (and spacing) so the string fits a region */
export function text(g, str, x, y, size, color = '#f1f4f2', o = {}) {
  g.save(); g.textAlign = o.align || 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  const set = (s, k = 1) => { g.font = `${o.weight || 700} ${s}px ${FONT}`; try { g.letterSpacing = `${(o.spacing ?? 0) * k}px`; } catch { /* optional */ } };
  set(size);
  if (o.maxW) { const w = g.measureText(str).width; if (w > o.maxW) { const k = o.maxW / w; size *= k; set(size, k); } }
  g.fillText(str, x, y); g.restore(); return size;
}
/** stencil lettering: text then thin vertical slits through each glyph (o.maxW shrinks to fit) */
export function stencil(g, str, x, y, size, color, o = {}) {
  size = text(g, str, x, y, size, color, { weight: 800, spacing: size * 0.08, ...o });
  g.save(); g.globalCompositeOperation = 'destination-out'; g.font = `800 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  try { g.letterSpacing = `${size * 0.08}px`; } catch { /* optional */ }
  const total = g.measureText(str).width; let cx = x - total / 2;
  for (const ch of str) { const wch = g.measureText(ch).width; if (ch !== ' ' && ch !== '-') g.fillRect(cx + wch / 2 - 0.7, y - size * 0.62, 1.5, size * 1.24); cx += wch; }
  g.restore();
}
export function emblem(g, cx, cy, R) {
  g.save(); g.translate(cx, cy);
  g.fillStyle = '#0b2531'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
  g.strokeStyle = '#37c9d8'; g.lineWidth = R * 0.09; g.beginPath(); g.arc(0, 0, R * 0.9, 0, TAU); g.stroke();
  g.fillStyle = '#f2f6f5'; g.fillRect(-R * 0.4, -R * 0.44, R * 0.15, R * 0.88); g.fillRect(R * 0.25, -R * 0.44, R * 0.15, R * 0.88); g.fillRect(-R * 0.33, -R * 0.07, R * 0.66, R * 0.14);
  g.strokeStyle = '#ff8c3a'; g.lineWidth = R * 0.07; g.beginPath(); g.ellipse(0, 0, R * 0.76, R * 0.3, -0.5, 0, TAU); g.stroke();
  g.fillStyle = '#ff8c3a'; g.beginPath(); g.arc(Math.cos(-0.5) * R * 0.76 * 0.99, Math.sin(-0.5) * R * 0.3, R * 0.075, 0, TAU); g.fill();
  g.restore();
}

// ───────────────────────────── style: textures, materials, wind ─────────────────────────────
/** shared per-build style object: memoised textures/materials, wind, animation clock */
export function createStyle(env) {
  const { kit } = env, memo = {};
  const once = (k, f) => (k in memo ? memo[k] : (memo[k] = f()));
  const [wx, wz] = (() => { const b = ((env.siteId === 'shore' ? 80 : 75) * Math.PI) / 180; return [Math.sin(b), -Math.cos(b)]; })();
  const S = {
    env, kit, THREE, wx, wz, windBase: env.site?.wind ?? 0.5,
    /** shared uniform for shimmer / sway shaders */
    uTime: { value: 0 },
    /** current wind speed 0..~1.2, direction jitter (rad), downwind rotation.y angle — advanced by S.tick(t) */
    wind: { v: 0.5, jit: 0, ang: Math.atan2(-wz, wx) },
    tick(t) { const b = S.windBase; S.uTime.value = t; S.wind.v = b * (0.82 + 0.3 * Math.sin(t * 0.37 + 1) + 0.2 * Math.sin(t * 0.91 + 2.3) + 0.1 * Math.sin(t * 2.3)); S.wind.jit = 0.16 * Math.sin(t * 0.23 + 0.7) + 0.07 * Math.sin(t * 0.71 + 2.1); },
  };
  const tex = {
    get paint() { return once('t.paint', () => kit.panelTexture({ base: '#e7e9e6', cols: 4, rows: 4, seed: 9, grimeAmt: 0.55, rivets: true })); },
    get corrug() {
      return once('t.corrug', () => kit.canvasTexture(128, 128, (g, w, h) => {
        g.fillStyle = '#d9d9d6'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 16; i++) { const x = i * 8, gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, 'rgba(0,0,0,0.30)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.28)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.0)'); gr.addColorStop(1, 'rgba(0,0,0,0.30)'); g.fillStyle = gr; g.fillRect(x, 0, 8, h); }
        kit.grime(g, w, h, { amount: 0.8, streaks: 10, seed: 21, color: 'rgba(30,26,20,0.16)' });
        g.fillStyle = 'rgba(60,40,20,0.12)'; for (let i = 0; i < 40; i++) g.fillRect((i * 37) % w, (i * 53) % h, 2, 3 + (i % 5));
      }));
    },
    get solar() {
      return once('t.solar', () => kit.canvasTexture(256, 256, (g, w, h) => {
        g.fillStyle = '#c8ccd2'; g.fillRect(0, 0, w, h);
        const m = 8, cw = (w - 2 * m) / 6, ch = (h - 2 * m) / 10;
        for (let j = 0; j < 10; j++) for (let i = 0; i < 6; i++) {
          const x = m + i * cw, y = m + j * ch, k = ((i * 7 + j * 13) % 5) * 0.012;
          const gr = g.createLinearGradient(x, y, x + cw, y + ch); gr.addColorStop(0, `rgb(${26 + k * 200 | 0},${40 + k * 250 | 0},${86 + k * 300 | 0})`); gr.addColorStop(1, `rgb(${16 + k * 150 | 0},${26 + k * 180 | 0},${60 + k * 240 | 0})`);
          g.fillStyle = gr; g.fillRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
          g.strokeStyle = 'rgba(190,200,215,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + cw / 3, y + 1.5); g.lineTo(x + cw / 3, y + ch - 1.5); g.moveTo(x + cw * 2 / 3, y + 1.5); g.lineTo(x + cw * 2 / 3, y + ch - 1.5); g.stroke();
        }
        const sh = g.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.10)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
        kit.grime(g, w, h, { amount: 0.25, streaks: 4, seed: 33, color: 'rgba(200,200,190,0.10)' });
      }));
    },
    get window() {
      return once('t.window', () => kit.canvasTexture(128, 96, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff0cf'); gr.addColorStop(0.5, '#f5bb68'); gr.addColorStop(1, '#a9682c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        const rl = g.createRadialGradient(w * 0.35, 0, 2, w * 0.35, 0, w * 0.6); rl.addColorStop(0, 'rgba(255,255,255,0.9)'); rl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rl; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(70,38,16,0.85)'; g.fillRect(w * 0.55, h * 0.50, w * 0.4, h * 0.05); g.fillRect(w * 0.58, h * 0.74, w * 0.36, h * 0.05);
        g.fillStyle = 'rgba(60,30,12,0.8)'; g.fillRect(w * 0.62, h * 0.38, w * 0.07, h * 0.12); g.fillRect(w * 0.75, h * 0.34, w * 0.05, h * 0.16); g.fillRect(w * 0.7, h * 0.62, w * 0.1, h * 0.12);
        g.fillStyle = 'rgba(90,200,215,0.9)'; g.fillRect(w * 0.08, h * 0.52, w * 0.3, h * 0.22); g.fillStyle = 'rgba(20,40,50,0.9)'; g.fillRect(w * 0.11, h * 0.55, w * 0.24, h * 0.16);
        g.fillStyle = 'rgba(70,38,16,0.8)'; g.fillRect(w * 0.0, h * 0.78, w, h * 0.22);
        g.fillStyle = 'rgba(40,24,12,0.9)'; g.fillRect(w * 0.49, 0, w * 0.025, h);
      }, { wrap: false }));
    },
    get flag() {
      return once('t.flag', () => kit.canvasTexture(256, 160, (g, w, h) => {
        g.fillStyle = '#0d3342'; g.fillRect(0, 0, w, h);
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = '#ee7a2c'; g.fillRect(0, h - 22, w, 12); g.fillStyle = '#f2f5f4'; g.fillRect(0, h - 8, w, 8);
        emblem(g, w * 0.5, h * 0.44, h * 0.34);
        kit.grime(g, w, h, { amount: 0.4, seed: 5, color: 'rgba(255,255,255,0.07)' });
      }, { wrap: false }));
    },
    /** fine grain (linear, repeat) — bump for sand patches, rocks, gravel */
    get grit() {
      return once('t.grit', () => kit.canvasTexture(128, 128, (g, w, h) => {
        g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, w, h); const r = kit.rng('grit');
        for (let i = 0; i < 2600; i++) { const v = (60 + r() * 190) | 0, s = 1 + r() * 2.2; g.fillStyle = `rgba(${v},${v},${v},0.6)`; g.fillRect(r() * w, r() * h, s, s); }
      }, { srgb: false }));
    },
    /** carbon-fibre twill (repeat) */
    get carbon() {
      return once('t.carbon', () => kit.canvasTexture(64, 64, (g, w, h) => {
        g.fillStyle = '#26282b'; g.fillRect(0, 0, w, h);
        for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
          const gr = (i + j) % 2 ? g.createLinearGradient(i * 8, j * 8, i * 8 + 8, j * 8 + 8) : g.createLinearGradient(i * 8 + 8, j * 8, i * 8, j * 8 + 8);
          gr.addColorStop(0, 'rgba(255,255,255,0.20)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(i * 8, j * 8, 8, 8);
        }
      }));
    },
  };
  const mat = {
    get paint() { return once('m.paint', () => kit.std({ color: 0xffffff, map: tex.paint, bumpMap: tex.paint, bumpScale: 1.4, vertexColors: true, roughness: 0.55, metalness: 0.05 })); },
    get corrug() { return once('m.corrug', () => kit.std({ color: 0xffffff, map: tex.corrug, bumpMap: tex.corrug, bumpScale: 2.2, vertexColors: true, roughness: 0.52, metalness: 0.18 })); },
    get metal() { return once('m.metal', () => kit.std({ color: 0xffffff, vertexColors: true, roughness: 0.42, metalness: 0.55 })); },
    get dark() { return once('m.dark', () => kit.std({ color: 0xffffff, vertexColors: true, roughness: 0.82, metalness: 0.05 })); },
    get solar() { return once('m.solar', () => kit.std({ color: 0xffffff, map: tex.solar, roughness: 0.26, metalness: 0.3 })); },
    get glass() { return once('m.glass', () => kit.glass({ opacity: 0.22 })); },
    get winGlow() { return once('m.winGlow', () => kit.screen(tex.window, 1.9)); },
    get lampGlow() { return once('m.lampGlow', () => kit.glow(0xffd2a0, 6)); },
    get greenGlow() { return once('m.greenGlow', () => kit.glow(0x45ff90, 3)); },
    get flag() { return once('m.flag', () => kit.std({ color: 0xffffff, map: tex.flag, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 })); },
    /** transparent vertex-RGBA ground patch (sand, gravel, soot) with grain bump; draw with renderOrder 1 */
    get patch() { return once('m.patch', () => kit.std({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.94, metalness: 0, bumpMap: tex.grit, bumpScale: 1.3 })); },
    /** lumpy rocks / pebbles / debris with vertex colour */
    get rock() { return once('m.rock', () => kit.std({ color: 0xffffff, vertexColors: true, roughness: 0.8, metalness: 0.02, bumpMap: tex.grit, bumpScale: 1.6 })); },
    get carbon() { return once('m.carbon', () => kit.std({ color: 0xffffff, map: tex.carbon, vertexColors: true, roughness: 0.34, metalness: 0.35, envMapIntensity: 1.0 })); },
    /** double-sided vertex-coloured fabric (windsock, tape, pennants) */
    get cloth() { return once('m.cloth', () => kit.std({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.88, metalness: 0 })); },
  };
  S.tex = tex; S.mat = mat; S.once = once;
  // deferred jobs (expensive canvas drawing) run one per timer tick after buildPois returns, so the build itself stays short
  S.jobs = []; S._timer = 0;
  S._run = () => { S._timer = 0; const j = S.jobs.shift(); if (j) { try { j(); } catch (e) { console.warn('[asphodel] deferred job failed', e); } } if (S.jobs.length) S._timer = setTimeout(S._run, 0); };
  S.later = (fn) => { S.jobs.push(fn); if (!S._timer) S._timer = setTimeout(S._run, 0); };
  S.cancel = () => { clearTimeout(S._timer); S._timer = 0; S.jobs.length = 0; };
  return S;
}

/** memoised canvas texture whose drawing is deferred (blank/transparent until painted — use only for decal-like textures). `draw` = fn(g, w, h) or an array of such steps (one per timer tick) */
export function deferredTexture(S, key, w, h, draw, opts) {
  return S.once(key, () => {
    const t = S.kit.canvasTexture(w, h, () => { /* blank */ }, opts), g = t.image.getContext('2d'), steps = Array.isArray(draw) ? draw : [draw];
    for (const fn of steps) S.later(() => { fn(g, w, h); t.needsUpdate = true; });
    return t;
  });
}

// ───────────────────────────── shared animated props ─────────────────────────────
/** cloth flag attached along its left edge at the origin, extending along +X; call .update(t) each frame */
export function makeFlag(S, { w = 1.5, h = 0.95, mat, segX = 14, segY = 7, amp = 0.16 } = {}) {
  const g = new THREE.PlaneGeometry(w, h, segX, segY); g.translate(w / 2, -h / 2, 0);
  const pos = g.attributes.position, nrm = g.attributes.normal, rx = new Float32Array(pos.count), ry = new Float32Array(pos.count), W1 = segX + 1;
  for (let i = 0; i < pos.count; i++) { rx[i] = pos.getX(i); ry[i] = pos.getY(i); }
  const mesh = new THREE.Mesh(g, mat || S.mat.flag); mesh.castShadow = true; mesh.receiveShadow = true;
  const normals = () => {   // central differences on the regular grid (rows run +y → −y): n = v × u, no allocations
    const p = pos.array, n = nrm.array;
    for (let iy = 0; iy <= segY; iy++) for (let ix = 0; ix <= segX; ix++) {
      const ia = (iy * W1 + Math.max(ix - 1, 0)) * 3, ib = (iy * W1 + Math.min(ix + 1, segX)) * 3, ja = (Math.max(iy - 1, 0) * W1 + ix) * 3, jb = (Math.min(iy + 1, segY) * W1 + ix) * 3, o = (iy * W1 + ix) * 3;
      const ux = p[ib] - p[ia], uy = p[ib + 1] - p[ia + 1], uz = p[ib + 2] - p[ia + 2], vx = p[jb] - p[ja], vy = p[jb + 1] - p[ja + 1], vz = p[jb + 2] - p[ja + 2];
      const nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux, l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      n[o] = nx / l; n[o + 1] = ny / l; n[o + 2] = nz / l;
    }
    nrm.needsUpdate = true;
  };
  return {
    mesh,
    update(t) {
      const v = clamp(S.wind.v, 0, 1.3), lift = clamp(0.25 + v * 1.1, 0, 1), a = amp * (0.35 + v * 1.1);
      for (let i = 0; i < pos.count; i++) {
        const k = rx[i] / w, y = ry[i], ph = t * (2.6 + v * 3.2) - rx[i] * 5.2 + y * 1.3, droop = (1 - lift) * k * k * 0.55 * h;
        pos.setXYZ(i, rx[i] * (1 - 0.06 * k * Math.abs(Math.sin(ph * 0.5)) * (0.5 + v)), y - droop + Math.sin(ph * 1.7 + 1) * 0.015 * k, Math.sin(ph) * a * k * (0.45 + 0.55 * (1 - Math.abs(y) / h)));
      }
      pos.needsUpdate = true; normals();
    },
  };
}

/** kit.beacon with an allocation-free update(t) (the kit's own update builds a THREE.Color + array every frame). opts as kit.beacon: { color, lightI, period, duty, phase (0..1), size, range } */
export function makeBeacon(S, pos, o = {}) {
  const b = S.kit.beacon(pos, { ...o, phase: o.phase ?? 0.5 }), color = new THREE.Color(o.color ?? 0xff8a2a), base = o.lightI ?? 10, period = o.period ?? 2.4, duty = o.duty ?? 0.14, phase = (o.phase ?? 0.5) * period, mat = b.bulb.material, light = b.light;
  b.update = (t) => { const p = ((t + phase) % period) / period, k = p < duty ? Math.sin(p / duty * Math.PI) : 0.04, s = 0.8 + 9 * k; light.intensity = base * k; mat.color.setRGB(color.r * s, color.g * s, color.b * s); };
  return b;
}

/** patch a (possibly already fog-patched) MeshStandardMaterial: chain onBeforeCompile + unique cache key */
export function patchMaterial(m, tag, fn) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = function (shader, renderer) { prev?.call(this, shader, renderer); fn(shader); };
  m.customProgramCacheKey = function () { return `${prevKey ? prevKey.call(this) : ''}|${tag}`; };
  m.needsUpdate = true; return m;
}
