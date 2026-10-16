// ORPHEUS · surface POIs — helpers shared by the two ice-world modules (poi_charon*.js and poi_cocytus*.js).
//
//  makeFrame(env, slot)      slot-local frame (x right as seen from the ship, z toward the ship) → place / ground sampling / base matrix
//  obbBoxes(...)             rotated-rectangle → several axis-aligned collider boxes
//  makeBatch(frame)          collect parts (vertex colours + slot-local box-projected UVs + baked ground-dirt) → ONE mesh per material (fast raw-array path)
//  groundPatch / ribbon      ground-following decals, trench floors, tracks
//  rockGeo / rbox / ...      small geometry builders (rbox = cheap chamfered box)
//  paintTexture / foilTexture / brushedTexture   canvas painters (≤ 512²)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';


export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _col = new THREE.Color();


// ───────────────────────────── slot frame ─────────────────────────────
/**
 * Slot-local frame. Local +Z faces the ship (the approach side), local +X is to the right as seen from the ship, local y = 0 is the pad ground (y0).
 * Parts are authored in local metres and baked into SHIP SPACE (the POI group itself stays at identity, per contract).
 */
export function makeFrame(env, slot, y0) {
  y0 = y0 ?? env.groundY(slot.x, slot.z);
  const yaw = slot.yaw, c = Math.cos(yaw), s = Math.sin(yaw);
  const base = new THREE.Matrix4().makeRotationY(yaw); base.setPosition(slot.x, y0, slot.z);
  const fr = {
    env, slot, x: slot.x, z: slot.z, y0, yaw, c, s, base,
    wx: (lx, lz) => slot.x + lx * c + lz * s,
    wz: (lx, lz) => slot.z - lx * s + lz * c,
    gy: (lx, lz) => env.groundY(slot.x + lx * c + lz * s, slot.z - lx * s + lz * c),
    /** local → world Vector3 (ly is height above the pad ground y0) */
    pos(lx, ly, lz, out) { return (out || new THREE.Vector3()).set(slot.x + lx * c + lz * s, y0 + ly, slot.z - lx * s + lz * c); },
    /** world → local */
    lx: (wx, wz) => (wx - slot.x) * c - (wz - slot.z) * s,
    lz: (wx, wz) => (wx - slot.x) * s + (wz - slot.z) * c,
    /** world direction [dx, dz] of a local direction */
    dirW: (lx, lz) => [lx * c + lz * s, -lx * s + lz * c],
    /** local direction [x, z] of a world direction */
    dirL: (wx, wz) => [wx * c - wz * s, wx * s + wz * c],
    /** put an Object3D at a local position (absolute world transform; yaw = frame yaw + ry) */
    place(obj, lx, ly, lz, ry = 0) { obj.position.set(slot.x + lx * c + lz * s, y0 + ly, slot.z - lx * s + lz * c); obj.rotation.set(0, yaw + ry, 0); return obj; },

  };
  return fr;
}

// ───────────────────────────── colliders ─────────────────────────────
/**
 * Rotated rectangle (local centre lx,lz; half extents hx,hz along the box's own axes; extra rotation ry) → axis-aligned world boxes.
 * Long boxes are sliced so the AABBs hug the real footprint. y0/y1 are heights above the pad ground.
 */
export function obbBoxes(fr, lx, lz, hx, hz, y0, y1, ry = 0, maxSlice = 1.25, shrink = 0) {
  const th = fr.yaw + ry, c = Math.cos(th), s = Math.sin(th);
  const cx = fr.wx(lx, lz), cz = fr.wz(lx, lz), a0 = fr.y0 + y0, a1 = fr.y0 + y1;
  const mk = (px, pz, shx, shz) => {
    const ex = Math.abs(c) * shx + Math.abs(s) * shz, ez = Math.abs(s) * shx + Math.abs(c) * shz;
    return { min: [px - ex + shrink, a0, pz - ez + shrink], max: [px + ex - shrink, a1, pz + ez - shrink] };
  };
  if (Math.abs(s * c) < 0.02) return [mk(cx, cz, hx, hz)];
  const alongX = hx >= hz, long = alongX ? hx : hz, n = Math.max(1, Math.ceil(2 * long / maxSlice)), step = 2 * long / n, out = [];
  for (let i = 0; i < n; i++) {
    const o = -long + step * (i + 0.5), ox = alongX ? o : 0, oz = alongX ? 0 : o;
    out.push(mk(cx + ox * c + oz * s, cz - ox * s + oz * c, alongX ? step / 2 : hx, alongX ? hz : step / 2));
  }
  return out;
}

// ───────────────────────────── batching ─────────────────────────────
function toColor(c, out) {
  if (c && c.isColor) return out.copy(c);
  if (Array.isArray(c)) return out.setRGB(c[0], c[1], c[2]);   // linear (HDR allowed)
  return out.set(c);
}

const _n3 = new THREE.Matrix3();

/** merge a list of position/normal/uv/color geometries (mixed indexed/non-indexed tolerated: loose ones get a sequential index) */
export function mergeAll(list) {
  const anyIdx = list.some((g) => g.index);
  for (const g of list) {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    if (anyIdx && !g.index) { const ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
  }
  return mergeGeometries(list, false) || new THREE.BufferGeometry();
}

/**
 * Parts → one mesh per material. Parts are transformed and appended straight into shared arrays (fast; the source geometry is not modified).
 * add(geo, {p, r, s, color, uv, uvS, dirt, dirtH}): p/r/s = slot-local pos / euler(YXZ) / scale, color = tint (hex | [r,g,b] linear HDR),
 * uv = slot-local box-projection scale (0 keeps the geometry's own UVs, then uvS = [su, sv] multiplies them), dirt = 0..1 darkening toward the ground over dirtH metres.
 */
export function makeBatch(fr, hint = 0) {
  const b = fr.base.elements;
  let cap = Math.max(2048, hint), icap = cap * 3, vcount = 0, icount = 0;
  let P = new Float32Array(cap * 3), N = new Float32Array(cap * 3), UV = new Float32Array(cap * 2), C = new Float32Array(cap * 3), I = new Uint32Array(icap);
  const growV = (need) => {
    if (vcount + need <= cap) return;
    while (vcount + need > cap) cap *= 2;
    const np = new Float32Array(cap * 3); np.set(P); P = np; const nn = new Float32Array(cap * 3); nn.set(N); N = nn;
    const nu = new Float32Array(cap * 2); nu.set(UV); UV = nu; const nc = new Float32Array(cap * 3); nc.set(C); C = nc;
  };
  const growI = (need) => { if (icount + need <= icap) return; while (icount + need > icap) icap *= 2; const ni = new Uint32Array(icap); ni.set(I); I = ni; };
  return {
    add(geo, o = {}) {
      const A = geo.attributes, pa = A.position.array, na = A.normal.array, ua = A.uv ? A.uv.array : null, n = A.position.count, gc = o.vcol && A.color ? A.color.array : null;
      const { p, r, s, color = 0xffffff, uv = 0.5, uvS, dirt = 0, dirtH = 0.9, uo = 0, vo = 0 } = o;
      if (p || r || s) {
        _e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, 'YXZ'); _q.setFromEuler(_e);
        if (s === undefined) _s.set(1, 1, 1); else if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
        _m.compose(p ? _p.set(p[0], p[1], p[2]) : _p.set(0, 0, 0), _q, _s);
      } else _m.identity();
      const m = _m.elements, nm = _n3.getNormalMatrix(_m).elements;
      toColor(color, _col);
      const cr = _col.r, cg = _col.g, cb = _col.b, su = uvS ? uvS[0] : 1, sv = uvS ? uvS[1] : 1, ia = geo.index ? geo.index.array : null, ni = ia ? ia.length : n;
      growV(n); growI(ni);
      for (let i = 0, v3 = vcount * 3, v2 = vcount * 2; i < n; i++, v3 += 3, v2 += 2) {
        const i3 = i * 3, x = pa[i3], y = pa[i3 + 1], z = pa[i3 + 2], gx = na[i3], gy = na[i3 + 1], gz = na[i3 + 2];
        const lx = m[0] * x + m[4] * y + m[8] * z + m[12], ly = m[1] * x + m[5] * y + m[9] * z + m[13], lz = m[2] * x + m[6] * y + m[10] * z + m[14];
        let nx = nm[0] * gx + nm[3] * gy + nm[6] * gz, ny = nm[1] * gx + nm[4] * gy + nm[7] * gz, nz = nm[2] * gx + nm[5] * gy + nm[8] * gz;
        const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
        let u = 0, v = 0;
        if (uv) {
          const ax = nx < 0 ? -nx : nx, ay = ny < 0 ? -ny : ny, az = nz < 0 ? -nz : nz;
          if (ay >= ax && ay >= az) { u = lx; v = lz; } else if (ax >= az) { u = lz; v = ly; } else { u = lx; v = ly; }
          u = u * uv + uo; v = v * uv + vo;
        } else if (ua) { u = ua[i * 2] * su; v = ua[i * 2 + 1] * sv; }
        const k = dirt > 0 ? 1 - dirt * (1 - smooth(0, dirtH, ly)) : 1;
        P[v3] = b[0] * lx + b[4] * ly + b[8] * lz + b[12]; P[v3 + 1] = b[1] * lx + b[5] * ly + b[9] * lz + b[13]; P[v3 + 2] = b[2] * lx + b[6] * ly + b[10] * lz + b[14];
        N[v3] = b[0] * nx + b[4] * ny + b[8] * nz; N[v3 + 1] = b[1] * nx + b[5] * ny + b[9] * nz; N[v3 + 2] = b[2] * nx + b[6] * ny + b[10] * nz;
        UV[v2] = u; UV[v2 + 1] = v;
        if (gc) { C[v3] = cr * k * gc[i * 3]; C[v3 + 1] = cg * k * gc[i * 3 + 1]; C[v3 + 2] = cb * k * gc[i * 3 + 2]; } else { C[v3] = cr * k; C[v3 + 1] = cg * k; C[v3 + 2] = cb * k; }
      }
      if (ia) for (let i = 0; i < ni; i++) I[icount + i] = ia[i] + vcount; else for (let i = 0; i < ni; i++) I[icount + i] = vcount + i;
      vcount += n; icount += ni;
    },
    get count() { return vcount; },
    build(material, { cast = true, receive = true } = {}) {
      if (!vcount) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P.slice(0, vcount * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(N.slice(0, vcount * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(UV.slice(0, vcount * 2), 2)); g.setAttribute('color', new THREE.BufferAttribute(C.slice(0, vcount * 3), 3));
      g.setIndex(new THREE.BufferAttribute(vcount > 65535 ? I.slice(0, icount) : Uint16Array.from(I.subarray(0, icount)), 1));
      vcount = 0; icount = 0;
      const mesh = new THREE.Mesh(g, material); mesh.castShadow = cast; mesh.receiveShadow = receive; return mesh;
    },
  };
}

// ───────────────────────────── geometry builders ─────────────────────────────
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const _gm = new Map();
const memo = (Ctor, name) => (...a) => { const k = name + ':' + a.join(','); let g = _gm.get(k); if (!g) { g = new Ctor(...a); _gm.set(k, g); } return g; };
/** memoised primitive geometries — the SAME object is returned for identical args, so NEVER mutate/merge them; only hand them to batch.add() */
export const GM = { Cylinder: memo(THREE.CylinderGeometry, 'cyl'), Box: memo(THREE.BoxGeometry, 'box'), Sphere: memo(THREE.SphereGeometry, 'sph'), Torus: memo(THREE.TorusGeometry, 'tor'), Cone: memo(THREE.ConeGeometry, 'cone'), Circle: memo(THREE.CircleGeometry, 'cir'), Plane: memo(THREE.PlaneGeometry, 'pln') };
/** chamfered box (crisp 45° bevel of size r on every edge): 96 vertices, 44 triangles — a cheap stand-in for a rounded box */
function rboxRaw(w, h, d, r) {
  const H = [w / 2, h / 2, d / 2], e = Math.min(r, H[0] * 0.49, H[1] * 0.49, H[2] * 0.49), I = [H[0] - e, H[1] - e, H[2] - e];
  const P = [], N = [], U = [], X = [], sg = [-1, 1];
  const poly = (pts, n) => {
    const c = cross3(sub3(pts[1], pts[0]), sub3(pts[2], pts[0]));
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0) pts = pts.slice().reverse();
    const base = P.length / 3;
    pts.forEach((q, i) => { P.push(q[0], q[1], q[2]); N.push(n[0], n[1], n[2]); U.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0); });
    for (let i = 1; i < pts.length - 1; i++) X.push(base, base + i, base + i + 1);
  };
  for (let k = 0; k < 3; k++) for (const s of sg) {
    const i = (k + 1) % 3, j = (k + 2) % 3, n = [0, 0, 0]; n[k] = s;
    const mk = (si, sj) => { const q = [0, 0, 0]; q[k] = s * H[k]; q[i] = si * I[i]; q[j] = sj * I[j]; return q; };
    poly([mk(-1, -1), mk(1, -1), mk(1, 1), mk(-1, 1)], n);
  }
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const k = 3 - i - j;
    for (const si of sg) for (const sj of sg) {
      const n = [0, 0, 0]; n[i] = si * Math.SQRT1_2; n[j] = sj * Math.SQRT1_2;
      const mk = (ai, aj, sk) => { const q = [0, 0, 0]; q[i] = si * ai; q[j] = sj * aj; q[k] = sk * I[k]; return q; };
      poly([mk(H[i], I[j], -1), mk(H[i], I[j], 1), mk(I[i], H[j], 1), mk(I[i], H[j], -1)], n);
    }
  }
  for (const sx of sg) for (const sy of sg) for (const sz of sg) {
    poly([[sx * H[0], sy * I[1], sz * I[2]], [sx * I[0], sy * H[1], sz * I[2]], [sx * I[0], sy * I[1], sz * H[2]]], [sx * 0.57735, sy * 0.57735, sz * 0.57735]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(X);
  return g;
}
export function rbox(w, h, d, r = 0.04) { const k = 'rb:' + w + ',' + h + ',' + d + ',' + r; let g = _gm.get(k); if (!g) { g = rboxRaw(w, h, d, r); _gm.set(k, g); } return g; }

function hash3(x, y, z, seed) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453; return s - Math.floor(s); }

const _icoCache = [];
/** angular, faceted rock (flat normals): jittered icosphere (cached template) with a flattened base. detail 0 = 20 faces, 1 = 80 faces */
export function rockGeo(seed, rx, ry = rx, rz = rx, { detail = 1, rough = 0.3, flatBottom = 0.6 } = {}) {
  const tpl = _icoCache[detail] || (_icoCache[detail] = new THREE.IcosahedronGeometry(1, detail).attributes.position.array.slice()), n = tpl.length / 3, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = tpl[i * 3], y = tpl[i * 3 + 1], z = tpl[i * 3 + 2], k = 1 + (hash3(x, y, z, seed) - 0.5) * 2 * rough;
    P[i * 3] = x * k * rx; P[i * 3 + 1] = Math.max(y * k, -flatBottom) * ry; P[i * 3 + 2] = z * k * rz;
  }
  for (let t = 0; t < n; t += 3) {
    const ax = P[t * 3 + 3] - P[t * 3], ay = P[t * 3 + 4] - P[t * 3 + 1], az = P[t * 3 + 5] - P[t * 3 + 2], bx = P[t * 3 + 6] - P[t * 3], by = P[t * 3 + 7] - P[t * 3 + 1], bz = P[t * 3 + 8] - P[t * 3 + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let j = 0; j < 3; j++) { N[(t + j) * 3] = nx; N[(t + j) * 3 + 1] = ny; N[(t + j) * 3 + 2] = nz; }
  }
  const C = new Float32Array(n * 3);
  for (let t = 0; t < n; t += 3) { const b = (0.78 + 0.34 * hash3(t, n, seed, 7)) * (0.82 + 0.18 * (N[t * 3 + 1] * 0.5 + 0.5)); for (let j = 0; j < 3; j++) { C[(t + j) * 3] = b; C[(t + j) * 3 + 1] = b; C[(t + j) * 3 + 2] = b * (0.97 + 0.06 * N[t * 3 + 1]); } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return g;
}

/** LatheGeometry from [[r, y], ...] */
export const lathe = (prof, seg = 32, phi0 = 0, phiLen = Math.PI * 2) => new THREE.LatheGeometry(prof.map((q) => new THREE.Vector2(q[0], q[1])), seg, phi0, phiLen);

/** swept tube through 3D points (CatmullRom) */
export function tubeGeo(points, radius, radial = 8, segs = Math.max(8, points.length * 6), curveType = 'centripetal') {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((q) => new THREE.Vector3(q[0], q[1], q[2])), false, curveType), segs, radius, radial, false);
}

const _strutTpl = new Map();
function strutTemplate(seg) {
  let t = _strutTpl.get(seg); if (t) return t;
  const cs = [], ys = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; for (const y of [0, 1]) { cs.push(Math.cos(a), Math.sin(a)); ys.push(y); uv.push(i / seg, y); } }
  for (let i = 0; i < seg; i++) { const b0 = i * 2, t0 = b0 + 1, b1 = b0 + 2, t1 = b0 + 3; idx.push(b0, t0, b1, b1, t0, t1); }
  t = { count: ys.length, cs: new Float32Array(cs), ys: new Float32Array(ys), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
  _strutTpl.set(seg, t); return t;
}

/** slender open cylinder from a to b (slot-local points), radius r0 at a and r1 at b — built straight from a cached template (no THREE primitives) */
export function strut(a, b, r0, r1 = r0, seg = 6) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, ix = dx / len, iy = dy / len, iz = dz / len;
  let ux, uy = 0, uz;
  if (Math.abs(iy) < 0.99) { ux = iz; uz = -ix; } else { ux = 1; uz = 0; }
  const ul = Math.sqrt(ux * ux + uz * uz) || 1; ux /= ul; uz /= ul;
  const vx = uy * iz - uz * iy, vy = uz * ix - ux * iz, vz = ux * iy - uy * ix;     // v = u × d (keeps the template winding)
  const t = strutTemplate(seg), n = t.count, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = t.cs[i * 2], s = t.cs[i * 2 + 1], y = t.ys[i], r = y ? r1 : r0, nx = ux * c + vx * s, ny = uy * c + vy * s, nz = uz * c + vz * s;
    P[i * 3] = a[0] + ix * len * y + nx * r; P[i * 3 + 1] = a[1] + iy * len * y + ny * r; P[i * 3 + 2] = a[2] + iz * len * y + nz * r;
    N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(t.uv, 2)); g.setIndex(new THREE.BufferAttribute(t.idx, 1));
  return g;
}

/** ground-following flat quad grid centred at local (lx,lz): w × d, rotation ry, lifted above the terrain. UV 0..1 (× rep). */
export function groundPatch(fr, lx, lz, w, d, ry = 0, nx = 8, nz = 8, lift = 0.025, rep = [1, 1]) {
  const pos = [], nor = [], uv = [], idx = [], env = fr.env, cr = Math.cos(ry), sr = Math.sin(ry), n = new THREE.Vector3();
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = (i / nx - 0.5) * w, v = (j / nz - 0.5) * d;
    const ox = lx + u * cr + v * sr, oz = lz - u * sr + v * cr, wx = fr.wx(ox, oz), wz = fr.wz(ox, oz);
    env.groundNormal(wx, wz, n);
    pos.push(wx, env.groundY(wx, wz) + lift, wz); nor.push(n.x, n.y, n.z); uv.push(i / nx * rep[0], (1 - j / nz) * rep[1]);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, dd = c + 1; idx.push(a, c, b, b, c, dd); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

/** ground-following ribbon along a local polyline pts [[lx,lz],…]; u = metres / uLen, v 0..1 across. (world-space vertices; add straight to the group) */
export function ribbon(fr, pts, width, { lift = 0.03, step = 1.0, uLen = 1, widthEnd } = {}) {
  const seg = [], env = fr.env; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
  const N = Math.max(1, Math.ceil(total / step)), pos = [], nor = [], uv = [], idx = [], n = new THREE.Vector3();
  for (let k = 0; k <= N; k++) {
    let s = total * k / N, i = 0; while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; }
    const t = seg[i] > 0 ? clamp(s / seg[i], 0, 1) : 0, a = pts[i], b = pts[i + 1];
    const px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t, dx = (b[0] - a[0]) / (seg[i] || 1), dz = (b[1] - a[1]) / (seg[i] || 1);
    const hw = (widthEnd == null ? width : lerp(width, widthEnd, k / N)) / 2;
    for (const sgn of [-1, 1]) {
      const ox = px - dz * hw * sgn, oz = pz + dx * hw * sgn, wx = fr.wx(ox, oz), wz = fr.wz(ox, oz);
      env.groundNormal(wx, wz, n); pos.push(wx, env.groundY(wx, wz) + lift, wz); nor.push(n.x, n.y, n.z); uv.push(total * k / N / uLen, sgn < 0 ? 0 : 1);
    }
    if (k) { const a0 = (k - 1) * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

// ───────────────────────────── texture painters ─────────────────────────────
/** draw `fn(ox, oy)` at the wrap offsets needed for a shape with bounding box (x0,y0,x1,y1) so that the texture tiles seamlessly */
function wrapDraw(W, H, x0, y0, x1, y1, fn) {
  const xs = [0], ys = [0];
  if (x0 < 0) xs.push(W);
  if (x1 > W) xs.push(-W);
  if (y0 < 0) ys.push(H);
  if (y1 > H) ys.push(-H);
  for (const ox of xs) for (const oy of ys) fn(ox, oy);
}

/** painted hard-surface panel tile: seams, bolts, scuffs, grime, micrometeorite pits. base/seam are CSS colours. */
export function paintTexture(kit, o = {}) {
  const { w = 512, h = 512, base = '#dcdedf', cols = 4, rows = 4, seed = 3, seam = 'rgba(28,32,38,0.62)', hi = 'rgba(255,255,255,0.38)', rivets = true, wear = 0.6, streaks = 16, grimeAmt = 0.5, pits = 0, repeat, tone = 0.08, aniso = 8 } = o;
  return kit.canvasTexture(w, h, (g, W, H) => {
    const r = kit.mulberry32(seed);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const cw = W / cols, ch = H / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const t = (r() - 0.5) * tone;
      g.fillStyle = t > 0 ? `rgba(255,255,255,${t})` : `rgba(0,0,0,${-t})`; g.fillRect(i * cw, j * ch, cw, ch);
      const gr = g.createLinearGradient(i * cw, j * ch, i * cw + cw * 0.9, j * ch + ch); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.075)');
      g.fillStyle = gr; g.fillRect(i * cw, j * ch, cw, ch);
    }
    g.lineWidth = 2.2;
    for (let i = 0; i < cols; i++) { g.strokeStyle = seam; g.beginPath(); g.moveTo(i * cw + 1, 0); g.lineTo(i * cw + 1, H); g.stroke(); g.strokeStyle = hi; g.lineWidth = 1; g.beginPath(); g.moveTo(i * cw + 3.2, 0); g.lineTo(i * cw + 3.2, H); g.stroke(); g.lineWidth = 2.2; }
    for (let j = 0; j < rows; j++) { g.strokeStyle = seam; g.beginPath(); g.moveTo(0, j * ch + 1); g.lineTo(W, j * ch + 1); g.stroke(); g.strokeStyle = hi; g.lineWidth = 1; g.beginPath(); g.moveTo(0, j * ch + 3.2); g.lineTo(W, j * ch + 3.2); g.stroke(); g.lineWidth = 2.2; }
    if (rivets) {
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        for (let k = 0; k < 5; k++) for (const [px, py] of [[(k + 0.5) / 5 * cw, 7], [(k + 0.5) / 5 * cw, ch - 5]]) { g.fillStyle = 'rgba(40,44,50,0.7)'; g.beginPath(); g.arc(i * cw + px, j * ch + py, 1.7, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(i * cw + px - 0.5, j * ch + py - 0.6, 0.7, 0, 7); g.fill(); }
      }
    }
    // scuffs / edge wear
    g.lineCap = 'round';
    for (let k = 0, n = Math.floor(wear * 140); k < n; k++) {
      const x = r() * W, y = r() * H, a = (r() - 0.5) * 1.4, l = 5 + r() * 26; g.lineWidth = 0.6 + r() * 1.3;
      g.strokeStyle = r() > 0.55 ? `rgba(255,255,255,${0.1 + r() * 0.2})` : `rgba(20,20,24,${0.06 + r() * 0.16})`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    if (pits) for (let k = 0, n = Math.floor(pits * 900); k < n; k++) { const x = r() * W, y = r() * H, s = 0.5 + r() * 1.3; g.fillStyle = r() > 0.4 ? 'rgba(25,26,30,0.35)' : 'rgba(255,255,255,0.3)'; g.fillRect(x, y, s, s); }
    kit.grime(g, W, H, { amount: grimeAmt, streaks, seed: seed + 5, color: 'rgba(24,22,22,0.16)', streakColor: 'rgba(26,22,18,0.15)' });
  }, { repeat, aniso });
}

/** crinkled multi-layer-insulation foil tile (seamless): also usable as bumpMap. */
export function foilTexture(kit, { w = 256, h = 256, seed = 9, tone = 'gold' } = {}) {
  const pal = tone === 'silver' ? ['#b4babf', '#eef1f3', '#6d747b'] : tone === 'black' ? ['#262320', '#5a544c', '#0d0c0b'] : ['#bd8c2e', '#f6d06a', '#6e4a10'];
  return kit.canvasTexture(w, h, (g, W, H) => {
    const r = kit.mulberry32(seed);
    g.fillStyle = pal[0]; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) {
      const cx = r() * W, cy = r() * H, s = 8 + r() * 30, a = r() * 6.283, hiTone = r() > 0.5;
      const p = [[cx + Math.cos(a) * s, cy + Math.sin(a) * s], [cx + Math.cos(a + 2.1 + r() * 0.7) * s * (0.5 + r() * 0.6), cy + Math.sin(a + 2.1) * s * (0.5 + r() * 0.6)], [cx + Math.cos(a + 4.2 + r() * 0.7) * s * (0.5 + r() * 0.6), cy + Math.sin(a + 4.2) * s * (0.5 + r() * 0.6)]];
      g.fillStyle = hiTone ? pal[1] : pal[2]; g.globalAlpha = 0.12 + r() * 0.3;
      wrapDraw(W, H, cx - s, cy - s, cx + s, cy + s, (ox, oy) => { g.beginPath(); g.moveTo(p[0][0] + ox, p[0][1] + oy); g.lineTo(p[1][0] + ox, p[1][1] + oy); g.lineTo(p[2][0] + ox, p[2][1] + oy); g.closePath(); g.fill(); });
    }
    g.globalAlpha = 1; g.lineCap = 'round';
    for (let i = 0; i < 60; i++) {
      const x = r() * W, y = r() * H, a = r() * 6.283, l = 10 + r() * 40, hiLine = r() > 0.5; g.lineWidth = 0.8 + r() * 1.2;
      g.strokeStyle = hiLine ? 'rgba(255,240,190,0.5)' : 'rgba(40,24,4,0.5)';
      wrapDraw(W, H, x - l, y - l, x + l, y + l, (ox, oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + Math.cos(a) * l + ox, y + Math.sin(a) * l + oy); g.stroke(); });
    }
  }, { aniso: 4 });
}

/** brushed metal grain: dir 'u' → streaks run along the texture's u axis, 'v' → along v. */
export function brushedTexture(kit, { w = 256, h = 256, seed = 4, base = '#b9bfc5', dir = 'u', repeat } = {}) {
  return kit.canvasTexture(w, h, (g, W, H) => {
    const r = kit.mulberry32(seed);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (const [col, n] of [['#ffffff', 150], ['#000000', 150]]) {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) { g.globalAlpha = 0.03 + r() * 0.09; if (dir === 'u') g.fillRect(0, r() * H, W, 0.6 + r() * 1.8); else g.fillRect(r() * W, 0, 0.6 + r() * 1.8, H); }
    }
    g.globalAlpha = 1;
  }, { repeat, aniso: 8 });
}

/** soft round alpha sprite (for glows / halos) */
export function softDotTexture(kit, size = 64, stops = [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]) {
  return kit.canvasTexture(size, size, (g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); for (const [t, c] of stops) gr.addColorStop(t, c); g.fillStyle = gr; g.fillRect(0, 0, W, H); }, { wrap: false, aniso: 1 });
}

/** triangular wedge (ramp body): width w along x (centred), height h at z = 0 falling to 0 at z = l, base on y = 0 */
export function wedgeGeo(w, h, l) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(l, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); g.translate(w / 2, 0, 0);
  return g;
}

/** frame for parts that live inside an animated Group (coordinates stay group-local; identity base matrix) */
export function identityFrame(env) { return { env, base: new THREE.Matrix4() }; }

/** trampled-regolith decal with crisp boot prints (alpha). opts.haze adds a soft disturbed-dust patch under the prints. */
export function bootsTexture(kit, { haze = false, seed = 12 } = {}) {
  return kit.canvasTexture(256, 256, (g, W, H) => {
    const r = kit.mulberry32(seed);
    g.clearRect(0, 0, W, H);
    if (haze) {
      const gr = g.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, W * 0.5); gr.addColorStop(0, 'rgba(18,17,16,0.30)'); gr.addColorStop(0.55, 'rgba(18,17,16,0.14)'); gr.addColorStop(1, 'rgba(18,17,16,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 260; i++) { g.fillStyle = r() > 0.5 ? 'rgba(210,204,196,0.12)' : 'rgba(10,9,8,0.14)'; const a = r() * 6.283, d = Math.sqrt(r()) * W * 0.46; g.fillRect(W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d, 1.5, 1.5); }
    }
    const print = (x, y, a, left) => {
      g.save(); g.translate(x, y); g.rotate(a); g.scale(left ? -1 : 1, 1);
      g.fillStyle = 'rgba(14,13,12,0.5)'; g.beginPath(); g.moveTo(-7, -17); g.quadraticCurveTo(-9, -4, -6, 9); g.quadraticCurveTo(-5, 16, 0, 16); g.quadraticCurveTo(5, 16, 5, 9); g.quadraticCurveTo(8, -4, 6, -17); g.quadraticCurveTo(0, -20, -7, -17); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.1; for (let k = -14; k < 8; k += 3.4) { g.beginPath(); g.moveTo(-5, k); g.lineTo(5, k + 1.2); g.stroke(); }
      g.strokeStyle = 'rgba(214,208,200,0.3)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-7.5, -16); g.quadraticCurveTo(-9.6, -3, -6.5, 10); g.stroke();
      g.restore();
    };
    for (let i = 0; i < 9; i++) print(60 + i * 14 + (r() - 0.5) * 3, 40 + i * 22, 0.18 + (r() - 0.5) * 0.12, i % 2 === 0);
    for (let i = 0; i < 7; i++) print(150 + (r() - 0.5) * 70, 130 + (r() - 0.5) * 80, r() * 6.28, r() > 0.5);
    for (let i = 0; i < 4; i++) print(190 + i * 9, 40 + i * 24, -0.35 + (r() - 0.5) * 0.1, i % 2 === 1);
  }, { wrap: false, aniso: 4 });
}
