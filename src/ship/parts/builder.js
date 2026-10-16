// MeshBuilder: accumulates transformed geometry (one buffer per material) — replaces per-mesh draw calls with a few merged meshes.
// Also: bevel-box arrays (hard-surface chamfered boxes), outline lofts (fuselage), and misc generators.
import * as THREE from 'three';

const _m3 = new THREE.Matrix3();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
const _m4 = new THREE.Matrix4();

// compose a Matrix4 from placement options { pos:[x,y,z], rot:[rx,ry,rz] | quat, scale: n | [sx,sy,sz] }
export function placement(o = {}, out = new THREE.Matrix4()) {
  if (o.matrix) return out.copy(o.matrix);
  const pos = o.pos || [0, 0, 0];
  _p.set(pos[0], pos[1], pos[2]);
  if (o.quat) _q.copy(o.quat); else if (o.rot) _q.setFromEuler(_e.set(o.rot[0] || 0, o.rot[1] || 0, o.rot[2] || 0, o.order || 'XYZ')); else _q.identity();
  if (o.scale == null) _s.set(1, 1, 1); else if (typeof o.scale === 'number') _s.set(o.scale, o.scale, o.scale); else _s.set(o.scale[0], o.scale[1], o.scale[2]);
  return out.compose(_p, _q, _s);
}

export class MeshBuilder {
  // uvMode: 'own' keeps geometry UVs; 'world' box-projects world positions (uvScale = 1 / metres-per-tile)
  constructor(uvMode = 'own', uvScale = 0.5) {
    this.pos = []; this.nor = []; this.uv = []; this.idx = []; this.vc = 0; this.uvMode = uvMode; this.uvScale = uvScale;
  }
  get empty() { return this.vc === 0; }
  append(o) { const base = this.vc; for (let i = 0; i < o.pos.length; i++) this.pos.push(o.pos[i]); for (let i = 0; i < o.nor.length; i++) this.nor.push(o.nor[i]); for (let i = 0; i < o.uv.length; i++) this.uv.push(o.uv[i]); for (let i = 0; i < o.idx.length; i++) this.idx.push(o.idx[i] + base); this.vc += o.vc; }
  addArrays(p, n, uv, idx, m) {
    const e = m.elements, base = this.vc, cnt = p.length / 3;
    _m3.getNormalMatrix(m); const ne = _m3.elements;
    const world = this.uvMode === 'world', S = this.uvScale;
    for (let i = 0; i < cnt; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx0 = n[i * 3], ny0 = n[i * 3 + 1], nz0 = n[i * 3 + 2];
      let nx = ne[0] * nx0 + ne[3] * ny0 + ne[6] * nz0, ny = ne[1] * nx0 + ne[4] * ny0 + ne[7] * nz0, nz = ne[2] * nx0 + ne[5] * ny0 + ne[8] * nz0;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      this.pos.push(wx, wy, wz); this.nor.push(nx, ny, nz);
      if (world) {
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        let u, v;
        if (ax >= ay && ax >= az) { u = (nx > 0 ? -wz : wz); v = wy; }
        else if (ay >= az) { u = wx; v = (ny > 0 ? wz : -wz); }
        else { u = (nz > 0 ? wx : -wx); v = wy; }
        this.uv.push(u * S, v * S);
      } else if (uv) this.uv.push(uv[i * 2], uv[i * 2 + 1]); else this.uv.push(0, 0);
    }
    for (let i = 0; i < idx.length; i++) this.idx.push(base + idx[i]);
    this.vc += cnt;
  }
  addGeometry(geo, m) {
    const p = geo.attributes.position.array, n = geo.attributes.normal ? geo.attributes.normal.array : null;
    let nn = n; if (!nn) { geo.computeVertexNormals(); nn = geo.attributes.normal.array; }
    const uv = geo.attributes.uv ? geo.attributes.uv.array : null;
    let idx;
    if (geo.index) idx = geo.index.array; else { const c = p.length / 3; idx = new Array(c); for (let i = 0; i < c; i++) idx[i] = i; }
    this.addArrays(p, nn, uv, idx, m);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.vc > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// ───────────── bevel (chamfer) box ─────────────
const _bbCache = new Map();
export function bevelBoxArrays(w, h, d, b) {
  const key = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}|${b.toFixed(4)}`;
  const hit = _bbCache.get(key); if (hit) return hit;
  const H = [w / 2, h / 2, d / 2];
  b = Math.max(0, Math.min(b, H[0] * 0.95, H[1] * 0.95, H[2] * 0.95));
  const p = [], n = [], uv = [], idx = [];
  const tri = (A, B, C, nx, ny, nz, uvs) => {
    const base = p.length / 3;
    for (const v of [A, B, C]) { p.push(v[0], v[1], v[2]); n.push(nx, ny, nz); }
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * nx + cy * ny + cz * nz >= 0) idx.push(base, base + 1, base + 2); else idx.push(base, base + 2, base + 1);
    for (let i = 0; i < 3; i++) uv.push(uvs ? uvs[i][0] : 0.5, uvs ? uvs[i][1] : 0.5);
  };
  const quad = (A, B, C, D, nx, ny, nz, uvs) => {
    tri(A, B, C, nx, ny, nz, uvs ? [uvs[0], uvs[1], uvs[2]] : null);
    tri(A, C, D, nx, ny, nz, uvs ? [uvs[0], uvs[2], uvs[3]] : null);
  };
  // faces
  for (let a = 0; a < 3; a++) {
    const u = (a + 1) % 3, v = (a + 2) % 3;
    for (const s of [-1, 1]) {
      const nrm = [0, 0, 0]; nrm[a] = s;
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => { const q = [0, 0, 0]; q[a] = s * H[a]; q[u] = su * (H[u] - b); q[v] = sv * (H[v] - b); return q; });
      quad(c[0], c[1], c[2], c[3], nrm[0], nrm[1], nrm[2], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
  if (b > 0) {
    // edges
    for (let a = 0; a < 3; a++) for (let c = a + 1; c < 3; c++) {
      const t = 3 - a - c;
      for (const sa of [-1, 1]) for (const sc of [-1, 1]) {
        const mk = (va, vc, vt) => { const q = [0, 0, 0]; q[a] = va; q[c] = vc; q[t] = vt; return q; };
        const A1 = mk(sa * H[a], sc * (H[c] - b), -(H[t] - b)), A2 = mk(sa * H[a], sc * (H[c] - b), (H[t] - b));
        const B2 = mk(sa * (H[a] - b), sc * H[c], (H[t] - b)), B1 = mk(sa * (H[a] - b), sc * H[c], -(H[t] - b));
        const nrm = [0, 0, 0]; nrm[a] = sa * Math.SQRT1_2; nrm[c] = sc * Math.SQRT1_2;
        quad(A1, A2, B2, B1, nrm[0], nrm[1], nrm[2], null);
      }
    }
    // corners
    const k = 1 / Math.sqrt(3);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      tri([sx * H[0], sy * (H[1] - b), sz * (H[2] - b)], [sx * (H[0] - b), sy * H[1], sz * (H[2] - b)], [sx * (H[0] - b), sy * (H[1] - b), sz * H[2]], sx * k, sy * k, sz * k, null);
    }
  }
  const out = { p, n, uv, idx };
  if (_bbCache.size < 4000) _bbCache.set(key, out);
  return out;
}

// ───────────── PCHIP interpolation (monotone cubic) for loft parameter tracks ─────────────
function pchipTangents(xs, ys) {
  const n = xs.length, d = new Array(n - 1), m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / Math.max(xs[i + 1] - xs[i], 1e-6);
  if (n === 2) { m[0] = m[1] = d[0]; return m; }
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const h0 = xs[i] - xs[i - 1], h1 = xs[i + 1] - xs[i], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  return m;
}
function pchipEval(xs, ys, m, x) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
  let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
}

// Rounded-rectangle outline with a fixed point count: loops from top-centre → +x side → bottom → −x side.
const OT = 3, OA = 6, OS = 4;
export const OUTLINE_N = (2 * (OT + (OA + 1) + (OS - 1) + (OA + 1) + OT) - 2);
export function roundRectOutline(w, top, bot, rc, cx = 0) {
  rc = Math.max(0.01, Math.min(rc, w * 0.98, (top - bot) * 0.49));
  const R = [];
  for (let i = 0; i < OT; i++) R.push([(w - rc) * i / OT, top]);
  for (let i = 0; i <= OA; i++) { const a = Math.PI / 2 * (1 - i / OA); R.push([w - rc + rc * Math.cos(a), top - rc + rc * Math.sin(a)]); }
  for (let i = 1; i < OS; i++) R.push([w, (top - rc) - (top - bot - 2 * rc) * i / OS]);
  for (let i = 0; i <= OA; i++) { const a = -Math.PI / 2 * (i / OA); R.push([w - rc + rc * Math.cos(a), bot + rc + rc * Math.sin(a)]); }
  for (let i = 1; i <= OT; i++) R.push([(w - rc) * (1 - i / OT), bot]);
  const out = R.map(([x, y]) => [cx + x, y]);
  for (let i = R.length - 2; i >= 1; i--) out.push([cx - R[i][0], R[i][1]]);
  return out;
}

// Loft along Z through stations [{ z, w, top, bot, rc, cx }] → closed (optionally capped) hull tube, own UVs (u = z, v = perimeter).
// opts: sub (segments per 1 m), caps:[front,back], uvScale (1 / metres per texture tile), perim (reference perimeter in metres, multiple of 1/uvScale)
export function loftGeometry(stations, opts = {}) {
  const { sub = 2.0, caps = [true, true], uvScale = 0.25, perim = 12, outline = null, cols = null } = opts;   // cols:[j0,j1) keeps only a strip of the outline (e.g. the dark underside)
  const zs = stations.map((s) => s.z);
  const keys = ['w', 'top', 'bot', 'rc', 'cx'];
  const trk = {};
  for (const k of keys) { const ys = stations.map((s) => (s[k] == null ? (k === 'rc' ? 0.4 : 0) : s[k])); trk[k] = { ys, m: pchipTangents(zs, ys) }; }
  // sample z positions: each station, plus subdivisions between
  const samples = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1], n = Math.max(1, Math.round((z1 - z0) * sub));
    for (let j = 0; j < n; j++) samples.push(z0 + (z1 - z0) * j / n);
  }
  samples.push(zs[zs.length - 1]);
  const rows = samples.map((z) => {
    const v = {}; for (const k of keys) v[k] = pchipEval(zs, trk[k].ys, trk[k].m, z);
    return { z, pts: outline ? outline(v, z) : roundRectOutline(v.w, v.top, v.bot, v.rc, v.cx), v };
  });
  const N = rows[0].pts.length, M = rows.length;
  const p = [], nrm = [], uv = [], idx = [];
  // positions (with duplicate seam vertex so v can wrap to an integer number of tiles)
  const W = N + 1;
  const sFrac = [];
  for (let r = 0; r < M; r++) {
    const pts = rows[r].pts; let tot = 0; const cum = [0];
    for (let j = 0; j < N; j++) { const a = pts[j], b = pts[(j + 1) % N]; tot += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(tot); }
    sFrac.push(cum.map((c) => c / tot));
  }
  for (let r = 0; r < M; r++) for (let j = 0; j <= N; j++) {
    const q = rows[r].pts[j % N];
    p.push(q[0], q[1], rows[r].z);
    uv.push(rows[r].z * uvScale, sFrac[r][j] * perim * uvScale);
  }
  // normals: from grid cross products
  const P = (r, j) => { const o = (r * W + (j % N)) * 3; return [p[o], p[o + 1], p[o + 2]]; };
  for (let r = 0; r < M; r++) for (let j = 0; j <= N; j++) {
    const r0 = Math.max(0, r - 1), r1 = Math.min(M - 1, r + 1);
    const a = P(r1, j), b = P(r0, j), c = P(r, j + 1), d = P(r, (j - 1 + N) % N);
    const dz = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dj = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
    let nx = dz[1] * dj[2] - dz[2] * dj[1], ny = dz[2] * dj[0] - dz[0] * dj[2], nz = dz[0] * dj[1] - dz[1] * dj[0];
    const q = P(r, j), cy = (rows[r].v.top + rows[r].v.bot) / 2, ox = q[0] - rows[r].v.cx, oy = q[1] - cy;
    if (nx * ox + ny * oy < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1; nrm.push(nx / l, ny / l, nz / l);
  }
  // indices (orientation chosen so that the normal above is the front face)
  for (let r = 0; r < M - 1; r++) for (let j = 0; j < N; j++) {
    if (cols && (j < cols[0] || j >= cols[1])) continue;
    const a = r * W + j, b = r * W + j + 1, c = (r + 1) * W + j + 1, d = (r + 1) * W + j;
    // test winding against the normal at a
    const pa = [p[a * 3], p[a * 3 + 1], p[a * 3 + 2]], pb = [p[b * 3], p[b * 3 + 1], p[b * 3 + 2]], pd = [p[d * 3], p[d * 3 + 1], p[d * 3 + 2]];
    const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], e2 = [pd[0] - pa[0], pd[1] - pa[1], pd[2] - pa[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    const dot = cx * nrm[a * 3] + cy * nrm[a * 3 + 1] + cz * nrm[a * 3 + 2];
    if (dot >= 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  }
  // caps
  const addCap = (r, front) => {
    const base = p.length / 3, row = rows[r], cy = (row.v.top + row.v.bot) / 2;
    p.push(row.v.cx, cy, row.z); nrm.push(0, 0, front ? -1 : 1); uv.push(0.5, 0.5);
    for (let j = 0; j < N; j++) { const q = row.pts[j]; p.push(q[0], q[1], row.z); nrm.push(0, 0, front ? -1 : 1); uv.push(q[0] * uvScale, q[1] * uvScale); }
    for (let j = 0; j < N; j++) { const a = base + 1 + j, b = base + 1 + ((j + 1) % N); if (front) idx.push(base, b, a); else idx.push(base, a, b); }
    // make sure orientation matches: first triangle normal
  };
  const flip = (start) => { // verify cap orientation against its declared normal, flipping if needed
    const i0 = idx[start], i1 = idx[start + 1], i2 = idx[start + 2];
    const A = [p[i0 * 3], p[i0 * 3 + 1], p[i0 * 3 + 2]], B = [p[i1 * 3], p[i1 * 3 + 1], p[i1 * 3 + 2]], C = [p[i2 * 3], p[i2 * 3 + 1], p[i2 * 3 + 2]];
    const cz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    return cz * nrm[i0 * 3 + 2];
  };
  if (caps[0]) { const s = idx.length; addCap(0, true); if (flip(s) < 0) for (let i = s; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } }
  if (caps[1]) { const s = idx.length; addCap(M - 1, false); if (flip(s) < 0) for (let i = s; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// sample the loft profile (for attaching parts to the skin): returns { w, top, bot, rc, cx } at z
export function loftProfile(stations, z) {
  const zs = stations.map((s) => s.z), out = {};
  for (const k of ['w', 'top', 'bot', 'rc', 'cx']) {
    const ys = stations.map((s) => (s[k] == null ? (k === 'rc' ? 0.4 : 0) : s[k]));
    out[k] = pchipEval(zs, ys, pchipTangents(zs, ys), z);
  }
  return out;
}

// Extrude a closed 2D polygon (array of [x,y]) to a prism with optional bevel — thin wrapper for plates/pods.
export function extrudePoly(pts, depth, bevel = 0) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Ruled surface between two polylines of equal length (each [x,y,z]) → grid geometry with own UV (u along polylines, v between)
export function ruledSurface(top, bot, { uvu = 1, uvv = 1 } = {}) {
  const n = top.length, p = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) { p.push(...top[i], ...bot[i]); uv.push(i / (n - 1) * uvu, uvv, i / (n - 1) * uvu, 0); }
  for (let i = 0; i < n - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
