// ORPHEUS · asphodel POIs — ground-hugging geometry that sits ON the terrain mesh (it can never dent it): terrain sampler, irregular
// blobs, path strips with a cross-section profile, vertex-colour tint, posing. Vertex colour is RGBA (alpha = soft edge) for patches.
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, noise2, fbm2 } from './poi_asphodel_parts.js';

/** terrain height sampler over a local frame (origin y0): coarse grid + bilinear, cheap and exact on flat pads. gy(lx, lz) → y relative to y0 */
export function makeGy(env, F, y0, ext = 16, step = 1) {
  const n = Math.round((2 * ext) / step) + 1, a = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const [x, z] = F.xz(-ext + i * step, -ext + j * step); a[j * n + i] = env.groundY(x, z) - y0; }
  return (lx, lz) => {
    const fx = clamp((lx + ext) / step, 0, n - 1.001), fz = clamp((lz + ext) / step, 0, n - 1.001), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    return a[j * n + i] * (1 - u) * (1 - v) + a[j * n + i + 1] * u * (1 - v) + a[(j + 1) * n + i] * (1 - u) * v + a[(j + 1) * n + i + 1] * u * v;
  };
}

const finish = (pos, cl, uv, idx, cs = 4) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, cs));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
};

/**
 * irregular polar blob (local frame). o: { gy, cx, cz, rx, rz, rot, rings, segs, wob, seed, lift, uvS, h(x,z,u,lx,lz) → extra y, col(x,z,u) → [r,g,b], alpha(u,x,z) → 0..1 }
 * u = 0 centre … 1 rim (rim radius wobbles with angle noise). Rim lift is pulled to `lift` so it merges with the terrain.
 */
export function blobGeo(o) {
  const { gy, cx = 0, cz = 0, rx, rz = rx, rot = 0, rings = 8, segs = 36, wob = 0.15, seed = 1, lift = 0.012, uvS = 2, h, col, alpha } = o;
  const cr = Math.cos(rot), sr = Math.sin(rot), pos = [], cl = [], uv = [], idx = [];
  const push = (u, a) => {
    const wr = 1 + wob * (fbm2(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3 + seed * 0.7, 3, seed) * 2 - 1), lx0 = Math.cos(a) * rx * u * wr, lz0 = Math.sin(a) * rz * u * wr;
    const x = cx + lx0 * cr + lz0 * sr, z = cz - lx0 * sr + lz0 * cr;
    pos.push(x, gy(x, z) + lift + (h ? h(x, z, u, lx0, lz0) : 0), z); uv.push(x * uvS, z * uvS);
    const c = col ? col(x, z, u) : [0.05, 0.05, 0.057]; cl.push(c[0], c[1], c[2], alpha ? alpha(u, x, z) : 1 - smooth(0.7, 1.0, u));
  };
  push(0, 0);
  for (let r = 1; r <= rings; r++) for (let s = 0; s < segs; s++) push(r / rings, (s / segs) * TAU);
  for (let s = 0; s < segs; s++) idx.push(0, 1 + (s + 1) % segs, 1 + s);
  for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) { const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + (s + 1) % segs, c = a + segs, d = b + segs; idx.push(a, b, c, b, d, c); }
  return finish(pos, cl, uv, idx);
}

/**
 * strip along a polyline [[x,z],…] (local). o: { gy, pts, cols, step, half(u) → half width, prof(t,u,x,z) → y offset (t −1..1 across), col(t,u,x,z) → [r,g,b], alpha(t,u) → 0..1, lift, uvS, tension }
 */
export function stripGeo(o) {
  const { gy, pts, cols = 13, step = 0.35, half, prof, col, alpha, lift = 0.01, uvS = 2 } = o;
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', o.tension ?? 0.5), n = Math.max(2, Math.ceil(curve.getLength() / step));
  const pos = [], cl = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, p = curve.getPoint(u), tg = curve.getTangent(u), nx = -tg.z, nz = tg.x, hw = half(u);
    for (let c = 0; c < cols; c++) {
      const t = (c / (cols - 1)) * 2 - 1, x = p.x + nx * t * hw, z = p.z + nz * t * hw, k = col ? col(t, u, x, z) : [0.05, 0.05, 0.057];
      pos.push(x, gy(x, z) + lift + (prof ? prof(t, u, x, z) : 0), z); uv.push(x * uvS, z * uvS); cl.push(k[0], k[1], k[2], alpha ? alpha(t, u) : 1);
    }
    if (i) for (let c = 0; c < cols - 1; c++) { const a = (i - 1) * cols + c, b = a + 1, cc = a + cols, d = cc + 1; idx.push(a, b, cc, b, d, cc); }
  }
  return finish(pos, cl, uv, idx);
}

/** multiply the vertex colours of a geometry by fn(x,y,z,nx,ny,nz) → number | [r,g,b] (tight loop; geometry must have a colour attribute) */
export function tintGeo(g, fn) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color, ca = C.array, cs = C.itemSize, n = g.attributes.position.count;
  for (let i = 0; i < n; i++) {
    const k = fn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
    if (typeof k === 'number') { ca[i * cs] *= k; ca[i * cs + 1] *= k; ca[i * cs + 2] *= k; } else { ca[i * cs] *= k[0]; ca[i * cs + 1] *= k[1]; ca[i * cs + 2] *= k[2]; }
  }
  C.needsUpdate = true; return g;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
/** pose a (merged) geometry: uniform scale, euler YXZ rotation, then translation; returns the geometry */
export function pose(g, pos, rot, sc = 1) {
  _e.set(rot[0], rot[1], rot[2], 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(sc, sc, sc)); g.applyMatrix4(_m); return g;
}
/** the same transform applied to a point (local → pose frame) */
export function posePoint(pt, pos, rot, out = [0, 0, 0]) {
  _e.set(rot[0], rot[1], rot[2], 'YXZ'); _q.setFromEuler(_e); _p.set(pt[0], pt[1], pt[2]).applyQuaternion(_q); out[0] = _p.x + pos[0]; out[1] = _p.y + pos[1]; out[2] = _p.z + pos[2]; return out;
}
export { lerp, noise2, clamp, smooth };
