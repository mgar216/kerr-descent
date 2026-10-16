// ORPHEUS · Phlegethon POI helpers (shared by poi_phlegethon_ridge.js + poi_phlegethon_forge.js).
// Procedural geometry builders, merged-by-material vertex-colour buckets, foil / solar / tread-plate / hazard textures,
// stencil-decal atlas helpers and a world-space ash-dust shader patch that chains onto kit.std() materials
// (the atmosphere-fog onBeforeCompile of env.fog is preserved).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, grime, mulberry32, stripeTexture } from './poi_common.js';

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _eu = new THREE.Euler(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _col = new THREE.Color();
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

// ───────────────────────────── geometry ─────────────────────────────
/** position / euler (YXZ) rotation / scale applied in place */
export function place(g, pos = null, rot = null, scale = 1) {
  if (!pos && !rot && scale === 1) return g;
  const p = pos || [0, 0, 0], r = rot || [0, 0, 0];
  _eu.set(r[0], r[1], r[2], 'YXZ'); _q.setFromEuler(_eu);
  if (typeof scale === 'number') _v2.set(scale, scale, scale); else _v2.set(scale[0], scale[1], scale[2]);
  _m4.compose(_v1.set(p[0], p[1], p[2]), _q, _v2); g.applyMatrix4(_m4);
  return g;
}

/** non-indexed triangle soup builder (position / normal / uv) — far cheaper than THREE primitives + toNonIndexed for hundreds of parts */
class Tris {
  constructor(tris) { this.pos = new Float32Array(tris * 9); this.nor = new Float32Array(tris * 9); this.uv = new Float32Array(tris * 6); this.n = 0; this.k = 1; }
  /** one vertex */
  v(x, y, z, nx, ny, nz, u, w) {
    const i = this.n++, o = i * 3, p = this.pos, q = this.nor;
    p[o] = x; p[o + 1] = y; p[o + 2] = z; q[o] = nx; q[o + 1] = ny; q[o + 2] = nz; this.uv[i * 2] = u; this.uv[i * 2 + 1] = w;
  }
  /** triangle a,b,c (arrays) wound CCW w.r.t. the outward normal N, planar-projected UVs (1 unit = 1/k metres) */
  tri(a, b, c, N) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    if ((uy * vz - uz * vy) * N[0] + (uz * vx - ux * vz) * N[1] + (ux * vy - uy * vx) * N[2] < 0) { const t = b; b = c; c = t; }
    const ax = Math.abs(N[0]), ay = Math.abs(N[1]), az = Math.abs(N[2]), k = this.k;
    for (let i = 0; i < 3; i++) {
      const p = i === 0 ? a : i === 1 ? b : c;
      if (ax >= ay && ax >= az) this.v(p[0], p[1], p[2], N[0], N[1], N[2], p[2] * k, p[1] * k);
      else if (ay >= az) this.v(p[0], p[1], p[2], N[0], N[1], N[2], p[0] * k, p[2] * k);
      else this.v(p[0], p[1], p[2], N[0], N[1], N[2], p[0] * k, p[1] * k);
    }
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    return g;
  }
}
/**
 * Chamfered box (44 triangles, flat-shaded bevels, world-scale planar UVs: 1 uv unit = `tile` m).
 * w,h,d = full extents, r = chamfer width.
 */
export function bevBox(w, h, d, r = 0.03, tile = 1.2) {
  const H = [w / 2, h / 2, d / 2];
  r = Math.min(r, H[0] * 0.98, H[1] * 0.98, H[2] * 0.98);
  const T = new Tris(44), N = [0, 0, 0], s3 = 1 / Math.sqrt(3);
  T.k = 1 / tile;
  for (let i = 0; i < 3; i++) for (let si = -1; si <= 1; si += 2) {   // faces
    const j = (i + 1) % 3, l = (i + 2) % 3, hj = H[j] - r, hl = H[l] - r;
    N[0] = N[1] = N[2] = 0; N[i] = si;
    const q = (sj, sl) => { const p = [0, 0, 0]; p[i] = si * H[i]; p[j] = sj * hj; p[l] = sl * hl; return p; };
    const p00 = q(-1, -1), p10 = q(1, -1), p11 = q(1, 1), p01 = q(-1, 1);
    T.tri(p00, p10, p11, N); T.tri(p00, p11, p01, N);
  }
  for (let i = 0; i < 3; i++) {                                         // edges
    const j = (i + 1) % 3, l = (i + 2) % 3, hl = H[l] - r;
    for (let si = -1; si <= 1; si += 2) for (let sj = -1; sj <= 1; sj += 2) {
      N[0] = N[1] = N[2] = 0; N[i] = si * Math.SQRT1_2; N[j] = sj * Math.SQRT1_2;
      const pa = (sl) => { const p = [0, 0, 0]; p[i] = si * H[i]; p[j] = sj * (H[j] - r); p[l] = sl * hl; return p; };
      const pb = (sl) => { const p = [0, 0, 0]; p[i] = si * (H[i] - r); p[j] = sj * H[j]; p[l] = sl * hl; return p; };
      const a0 = pa(-1), b0 = pb(-1), b1 = pb(1), a1 = pa(1);
      T.tri(a0, b0, b1, N); T.tri(a0, b1, a1, N);
    }
  }
  for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) for (let sz = -1; sz <= 1; sz += 2) {   // corners
    N[0] = sx * s3; N[1] = sy * s3; N[2] = sz * s3;
    T.tri([sx * H[0], sy * (H[1] - r), sz * (H[2] - r)], [sx * (H[0] - r), sy * H[1], sz * (H[2] - r)], [sx * (H[0] - r), sy * (H[1] - r), sz * H[2]], N);
  }
  return T.geo();
}
/** sharp box (12 triangles) with world-scale UVs */
export function box(w, h, d, tile = 1.2) {
  const H = [w / 2, h / 2, d / 2], T = new Tris(12), N = [0, 0, 0];
  T.k = 1 / tile;
  for (let i = 0; i < 3; i++) for (let si = -1; si <= 1; si += 2) {
    const j = (i + 1) % 3, l = (i + 2) % 3;
    N[0] = N[1] = N[2] = 0; N[i] = si;
    const q = (sj, sl) => { const p = [0, 0, 0]; p[i] = si * H[i]; p[j] = sj * H[j]; p[l] = sl * H[l]; return p; };
    const p00 = q(-1, -1), p10 = q(1, -1), p11 = q(1, 1), p01 = q(-1, 1);
    T.tri(p00, p10, p11, N); T.tri(p00, p11, p01, N);
  }
  return T.geo();
}
/** multiply the UVs of a geometry */
export function scaleUV(g, su = 1, sv = 1) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }

/** box of cross-section w×h running from point a to point b (h is the roughly-vertical dimension) */
export function beam(a, b, w, h = w) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1e-6, d = [dx / len, dy / len, dz / len];
  const hv = Math.abs(d[1]) > 0.97 ? [1, 0, 0] : [0, 1, 0];
  let sx = hv[1] * d[2] - hv[2] * d[1], sy = hv[2] * d[0] - hv[0] * d[2], sz = hv[0] * d[1] - hv[1] * d[0];
  const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
  const ux = d[1] * sz - d[2] * sy, uy = d[2] * sx - d[0] * sz, uz = d[0] * sy - d[1] * sx;
  const T = new Tris(12), hw = w / 2, hh = h / 2;
  const P = (t, a1, a2) => [a[0] + d[0] * t + sx * hw * a1 + ux * hh * a2, a[1] + d[1] * t + sy * hw * a1 + uy * hh * a2, a[2] + d[2] * t + sz * hw * a1 + uz * hh * a2];
  const q = [P(0, -1, -1), P(0, 1, -1), P(0, 1, 1), P(0, -1, 1), P(len, -1, -1), P(len, 1, -1), P(len, 1, 1), P(len, -1, 1)];
  const quad = (i0, i1, i2, i3, N) => { T.tri(q[i0], q[i1], q[i2], N); T.tri(q[i0], q[i2], q[i3], N); };
  quad(0, 3, 2, 1, [-d[0], -d[1], -d[2]]); quad(4, 5, 6, 7, d);
  quad(0, 4, 7, 3, [-sx, -sy, -sz]); quad(1, 2, 6, 5, [sx, sy, sz]);
  quad(0, 1, 5, 4, [-ux, -uy, -uz]); quad(3, 7, 6, 2, [ux, uy, uz]);
  return T.geo();
}
const _cs = {};
/** (tapered) round tube from a (radius r0) to b (radius r1); UV u = around (0..1), v = along (0..1); open = no end caps */
export function tube(a, b, r0, r1 = r0, radial = 8, open = true) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1e-6, d = [dx / len, dy / len, dz / len];
  const hv = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let ex = hv[1] * d[2] - hv[2] * d[1], ey = hv[2] * d[0] - hv[0] * d[2], ez = hv[0] * d[1] - hv[1] * d[0];
  const el = Math.hypot(ex, ey, ez) || 1; ex /= el; ey /= el; ez /= el;
  const fx = d[1] * ez - d[2] * ey, fy = d[2] * ex - d[0] * ez, fz = d[0] * ey - d[1] * ex;   // e1 × e2 = d
  const tab = _cs[radial] || (_cs[radial] = Array.from({ length: radial + 1 }, (_, i) => [Math.cos(i / radial * TAU), Math.sin(i / radial * TAU)]));
  const T = new Tris(radial * 2 + (open ? 0 : radial * 2));
  for (let i = 0; i < radial; i++) {
    const [c0, s0] = tab[i], [c1, s1] = tab[i + 1];
    const n0x = ex * c0 + fx * s0, n0y = ey * c0 + fy * s0, n0z = ez * c0 + fz * s0, n1x = ex * c1 + fx * s1, n1y = ey * c1 + fy * s1, n1z = ez * c1 + fz * s1;
    const u0 = i / radial, u1 = (i + 1) / radial;
    const A0 = [a[0] + n0x * r0, a[1] + n0y * r0, a[2] + n0z * r0], A1 = [a[0] + n1x * r0, a[1] + n1y * r0, a[2] + n1z * r0];
    const B0 = [b[0] + n0x * r1, b[1] + n0y * r1, b[2] + n0z * r1], B1 = [b[0] + n1x * r1, b[1] + n1y * r1, b[2] + n1z * r1];
    T.v(A0[0], A0[1], A0[2], n0x, n0y, n0z, u0, 0); T.v(A1[0], A1[1], A1[2], n1x, n1y, n1z, u1, 0); T.v(B1[0], B1[1], B1[2], n1x, n1y, n1z, u1, 1);
    T.v(A0[0], A0[1], A0[2], n0x, n0y, n0z, u0, 0); T.v(B1[0], B1[1], B1[2], n1x, n1y, n1z, u1, 1); T.v(B0[0], B0[1], B0[2], n0x, n0y, n0z, u0, 1);
    if (!open) {
      T.v(a[0], a[1], a[2], -d[0], -d[1], -d[2], 0.5, 0.5); T.v(A1[0], A1[1], A1[2], -d[0], -d[1], -d[2], 0.5 + c1 * 0.5, 0.5 + s1 * 0.5); T.v(A0[0], A0[1], A0[2], -d[0], -d[1], -d[2], 0.5 + c0 * 0.5, 0.5 + s0 * 0.5);
      T.v(b[0], b[1], b[2], d[0], d[1], d[2], 0.5, 0.5); T.v(B0[0], B0[1], B0[2], d[0], d[1], d[2], 0.5 + c0 * 0.5, 0.5 + s0 * 0.5); T.v(B1[0], B1[1], B1[2], d[0], d[1], d[2], 0.5 + c1 * 0.5, 0.5 + s1 * 0.5);
    }
  }
  return T.geo();
}
/** vertical-axis cylinder with its base at y = 0 (centre bottom) */
export function cylY(r0, r1, h, radial = 12, open = false) { return tube([0, 0, 0], [0, h, 0], r0, r1, radial, open); }
/** shallow spherical dish: rim circle radius r, depth `depth`, vertex at z = 0, opening toward +Z (render with DoubleSide) */
export function dishGeo(r, depth, seg = 24) {
  const R = (r * r + depth * depth) / (2 * depth), th = Math.asin(Math.min(1, r / R));
  const g = new THREE.SphereGeometry(R, seg, 8, 0, TAU, Math.PI - th, th);
  g.rotateX(Math.PI / 2); g.translate(0, 0, R);
  return g;
}
/** sample a hanging cable between a and b (sag in metres at the middle) → [[x,y,z],…] */
export function catenary(a, b, sag, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t)]); }
  return pts;
}

// ───────────────────────────── vertex-colour buckets ─────────────────────────────
function colorOf(c) {
  if (c && c.isColor) return c;
  if (Array.isArray(c)) return _col.setRGB(c[0], c[1], c[2]);
  return _col.set(c);
}
function normaliseAttrs(g) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') g.deleteAttribute(k);
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.color) { const c = new Float32Array(n * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  return g;
}
/** vertex-colour shading hook: fn(x, y, z, rgb[3]) mutates rgb in place */
export function shade(g, fn) {
  const p = g.attributes.position, c = g.attributes.color, t = [0, 0, 0];
  for (let i = 0; i < p.count; i++) { t[0] = c.getX(i); t[1] = c.getY(i); t[2] = c.getZ(i); fn(p.getX(i), p.getY(i), p.getZ(i), t); c.setXYZ(i, t[0], t[1], t[2]); }
  return g;
}

/** collects parts that share one material; `mesh(material, matrix?)` merges them into one draw call */
export class Bucket {
  constructor(seed = 1, jitter = 0.07) { this.items = []; this.rnd = mulberry32(seed); this.jitter = jitter; }
  /** transform (pos, rot[YXZ euler], scale) + vertex colour (hex | Color | linear [r,g,b]) */
  add(g, pos = null, rot = null, color = 0xffffff, scale = 1) { place(g, pos, rot, scale); return this.raw(g, color, false); }
  /** same as add() but the part is already in world space — it is NOT moved by the matrix given to mesh()/geometry() */
  addW(g, pos = null, rot = null, color = 0xffffff, scale = 1) { place(g, pos, rot, scale); return this.raw(g, color, true); }
  /** add an already-placed geometry; world=true keeps it out of the bucket matrix */
  raw(g, color = 0xffffff, world = false) {
    let geo = g;
    if (g.index) { geo = g.toNonIndexed(); g.dispose(); }
    const c = colorOf(color), k = 1 + (this.rnd() - 0.5) * 2 * this.jitter, n = geo.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.items.push({ g: geo, w: world });
    return geo;
  }
  beam(a, b, w, h, color) { return this.raw(beam(a, b, w, h), color, false); }
  tube(a, b, r0, r1, radial, color) { return this.raw(tube(a, b, r0, r1, radial), color, false); }
  /** cable through points (draws a chain of thin tubes) */
  cable(points, r, color, radial = 4) { for (let i = 0; i < points.length - 1; i++) this.raw(tube(points[i], points[i + 1], r, r, radial), color, false); }
  get count() { return this.items.length; }
  /** run a vertex-colour shading hook over the parts: which = 'local' | 'world' | 'all' (call BEFORE geometry()/mesh()) */
  shadeAll(fn, which = 'local') { for (const it of this.items) if (which === 'all' || (which === 'world') === it.w) shade(it.g, fn); return this; }
  geometry(M = null) {
    const list = [];
    for (const it of this.items) { if (M && !it.w) it.g.applyMatrix4(M); list.push(normaliseAttrs(it.g)); }
    const g = list.length ? mergeGeometries(list, false) : new THREE.BufferGeometry();
    for (const x of list) x.dispose();
    this.items.length = 0;
    return g;
  }
  mesh(material, M = null) { const m = new THREE.Mesh(this.geometry(M), material); m.castShadow = true; m.receiveShadow = true; return m; }
}

// ───────────────────────────── textures ─────────────────────────────
/**
 * crinkled MLI foil: greyscale albedo (tint via material colour) + normal map = smooth multi-scale undulation + sharp random creases.
 * (cheap: tiny noise layers upscaled with bilinear filtering, plus a few dozen crease strokes)
 */
export function foilMaps(seed = 5, size = 256) {
  const rnd = mulberry32(seed);
  const noiseLayer = (n, spread, grey) => {
    const c = document.createElement('canvas'); c.width = c.height = n; const cg = c.getContext('2d'), id = cg.createImageData(n, n), d = id.data;
    for (let i = 0; i < n * n; i++) {
      if (grey) { const v = 128 + (rnd() - 0.5) * spread; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; } else { d[i * 4] = 128 + (rnd() - 0.5) * spread; d[i * 4 + 1] = 128 + (rnd() - 0.5) * spread; d[i * 4 + 2] = 255; }
      d[i * 4 + 3] = 255;
    }
    cg.putImageData(id, 0, 0); return c;
  };
  const layers = (g, w, h, grey, spread) => {
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const a0 = g.globalAlpha;
    for (const [n, a] of [[88, 1], [44, 0.55], [18, 0.55]]) { g.globalAlpha = a0 * a; g.drawImage(noiseLayer(n, spread, grey), 0, 0, n, n, 0, 0, w, h); }
    g.globalAlpha = a0;
  };
  const creases = [];
  for (let i = 0; i < 110; i++) {
    const x = rnd() * size, y = rnd() * size, a = rnd() * TAU, len = 18 + rnd() * 70, bend = (rnd() - 0.5) * 0.9, pts = [[x, y]];
    for (let k = 1; k <= 3; k++) { const aa = a + bend * k, p = pts[k - 1]; pts.push([p[0] + Math.cos(aa) * len / 3, p[1] + Math.sin(aa) * len / 3]); }
    creases.push({ pts, str: 0.35 + rnd() * 0.65 });
  }
  const strokeCreases = (g, w, h, fn) => {
    for (const cr of creases) for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      const p0 = cr.pts[0]; if (p0[0] + dx < -80 || p0[0] + dx > w + 80 || p0[1] + dy < -80 || p0[1] + dy > h + 80) continue;
      for (let k = 0; k < cr.pts.length - 1; k++) {
        const [ax, ay] = cr.pts[k], [bx, by] = cr.pts[k + 1], L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
        fn(g, ax + dx, ay + dy, bx + dx, by + dy, nx, ny, cr.str);
      }
    }
  };
  const map = canvasTexture(size, size, (g, w, h) => {
    g.fillStyle = '#c2c2c2'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.22; layers(g, w, h, true, 150); g.globalAlpha = 1;
    g.lineCap = 'round';
    strokeCreases(g, w, h, (g2, ax, ay, bx, by, nx, ny, s) => {
      g2.lineWidth = 1.8; g2.strokeStyle = `rgba(20,14,6,${0.10 * s})`; g2.beginPath(); g2.moveTo(ax + nx, ay + ny); g2.lineTo(bx + nx, by + ny); g2.stroke();
      g2.lineWidth = 1.3; g2.strokeStyle = `rgba(255,250,235,${0.16 * s})`; g2.beginPath(); g2.moveTo(ax - nx * 1.2, ay - ny * 1.2); g2.lineTo(bx - nx * 1.2, by - ny * 1.2); g2.stroke();
    });
    g.fillStyle = 'rgba(235,235,235,0.30)'; g.fillRect(0, 0, 6, h); g.fillRect(0, 0, w, 6);
    grime(g, w, h, { amount: 0.4, color: 'rgba(25,15,5,0.14)', size: [0.8, 3], seed: seed + 3 });
  }, { aniso: 8 });
  const normalMap = canvasTexture(size, size, (g, w, h) => {
    g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, w, h);
    layers(g, w, h, false, 170);
    g.lineCap = 'round';
    strokeCreases(g, w, h, (g2, ax, ay, bx, by, nx, ny, s) => {
      const k = 0.95 * s;
      g2.lineWidth = 2.4; g2.strokeStyle = `rgb(${(128 + nx * k * 127) | 0},${(128 + ny * k * 127) | 0},235)`; g2.beginPath(); g2.moveTo(ax + nx * 1.4, ay + ny * 1.4); g2.lineTo(bx + nx * 1.4, by + ny * 1.4); g2.stroke();
      g2.strokeStyle = `rgb(${(128 - nx * k * 127) | 0},${(128 - ny * k * 127) | 0},235)`; g2.beginPath(); g2.moveTo(ax - nx * 1.4, ay - ny * 1.4); g2.lineTo(bx - nx * 1.4, by - ny * 1.4); g2.stroke();
    });
    g.fillStyle = 'rgb(128,128,255)';
    g.fillRect(0, 0, 6, h); g.fillRect(0, 0, w, 6);
  }, { srgb: false, aniso: 8 });
  return { map, normalMap };
}

/** monocrystalline solar array tile: cols × rows cells */
export function solarTexture(cols = 6, rows = 6, size = 256) {
  return canvasTexture(size, size, (g, w, h) => {
    g.fillStyle = '#7d8696'; g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows, rnd = mulberry32(21);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = i * cw + 1.4, y = j * ch + 1.4, ww = cw - 2.8, hh = ch - 2.8, c = 7;
      const gr = g.createLinearGradient(x, y, x + ww, y + hh); const s = rnd() * 10;
      gr.addColorStop(0, `rgb(${26 + s},${44 + s},${98 + s})`); gr.addColorStop(1, `rgb(${16 + s},${28 + s},${66 + s})`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + ww - c, y); g.lineTo(x + ww, y + c); g.lineTo(x + ww, y + hh - c); g.lineTo(x + ww - c, y + hh); g.lineTo(x + c, y + hh); g.lineTo(x, y + hh - c); g.lineTo(x, y + c); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,150,210,0.30)'; g.lineWidth = 1; g.beginPath();
      for (let k = 1; k < 5; k++) { const xx = x + ww * k / 5; g.moveTo(xx, y + 1); g.lineTo(xx, y + hh - 1); }
      g.stroke();
      g.strokeStyle = 'rgba(210,220,240,0.55)'; g.beginPath(); g.moveTo(x + ww * 0.33, y); g.lineTo(x + ww * 0.33, y + hh); g.moveTo(x + ww * 0.66, y); g.lineTo(x + ww * 0.66, y + hh); g.stroke();
    }
    grime(g, w, h, { amount: 0.5, color: 'rgba(60,48,40,0.22)', size: [0.8, 3], streaks: 6, seed: 5 });
  });
}

/** diamond tread-plate / deck texture */
export function plateTexture(seed = 4, size = 256) {
  return canvasTexture(size, size, (g, w, h) => {
    g.fillStyle = '#3d4247'; g.fillRect(0, 0, w, h);
    const n = 10, s = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const cx = (i + 0.5) * s, cy = (j + 0.5) * s, a = ((i + j) & 1) ? Math.PI / 4 : -Math.PI / 4;
      for (const [ox, oy, col] of [[1.2, 1.6, 'rgba(0,0,0,0.5)'], [0, 0, '#79818a']]) {
        g.save(); g.translate(cx + ox, cy + oy); g.rotate(a); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, s * 0.36, s * 0.1, 0, 0, TAU); g.fill(); g.restore();
      }
    }
    grime(g, w, h, { amount: 0.8, color: 'rgba(14,10,8,0.24)', size: [1, 3.4], streaks: 8, seed });
  });
}

/** weathered yellow/black hazard stripes (square tile, diagonal stripes) */
export function hazardTexture() {
  const t = stripeTexture({ a: '#e2ad12', b: '#17191c', n: 6, w: 128, h: 128 });
  const g = t.image.getContext('2d');
  grime(g, 128, 128, { amount: 0.9, color: 'rgba(20,14,8,0.26)', size: [0.8, 2.6], streaks: 5, seed: 8 });
  t.needsUpdate = true;
  return t;
}

// ───────────────────────────── stencil decal atlas ─────────────────────────────
const FONT = 'Bahnschrift, "Arial Narrow", Rajdhani, "Segoe UI", Arial, sans-serif';
/** printed text centred at (x,y), font shrunk (from `size`) so it fits `maxW` */
export function label(g, text, x, y, maxW, size, color = '#16181b', weight = 800, font = FONT) {
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.font = `${weight} ${size}px ${font}`;
  const w = g.measureText(text).width; if (w > maxW) g.font = `${weight} ${Math.floor(size * maxW / w)}px ${font}`;
  g.fillText(text, x, y); g.restore();
}
/** stencil lettering: text with bridge cuts across every glyph + chipped paint (o.maxW shrinks to fit). Draw inside a decal-cell draw callback. */
export function stencil(g, text, x, y, size, color = '#e9e3d6', o = {}) {
  g.save();
  const font = o.font || FONT, weight = o.weight || 800, sp = o.spacing ?? 0;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  const setFont = (s) => { g.font = `${weight} ${s}px ${font}`; if ('letterSpacing' in g) g.letterSpacing = `${sp * s / size}px`; };
  setFont(size);
  let total = g.measureText(text).width;
  if (o.maxW && total > o.maxW) { size = Math.floor(size * o.maxW / total); setFont(size); total = g.measureText(text).width; }
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
  g.fillStyle = color; g.fillText(text, x0, y);
  if (o.bridges !== false) {
    g.globalCompositeOperation = 'destination-out';
    let cx = x0; const bh = Math.max(1.2, size * 0.065);
    for (const ch of text) {
      const w = g.measureText(ch).width;
      if (ch !== ' ' && ch !== '-' && ch !== '·') { g.fillRect(cx - 1, y - size * 0.02 - bh / 2, w + 2, bh); if ('OQDGCBS0'.includes(ch)) g.fillRect(cx + w * 0.46, y - size * 0.4, Math.max(1.2, size * 0.055), size * 0.8); }
      cx += w;
    }
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}
/** chip / wear a drawn decal cell (destination-out specks) */
export function wear(g, w, h, amount = 0.5, seed = 3) {
  const r = mulberry32(seed), n = Math.floor(amount * w * h / 70);
  g.save(); g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${0.35 + r() * 0.6})`; const s = 0.6 + r() * r() * 4; g.fillRect(r() * w, r() * h, s * (0.5 + r() * 2), s); }
  g.restore();
}
/** atlas from named cells {x,y,w,h,draw(g,w,h)} → { tex, rects } (rect = [u0,v0,u1,v1]) */
export function decalAtlas(W, H, cells) {
  const rects = {};
  const tex = canvasTexture(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    for (const [name, c] of Object.entries(cells)) {
      g.save(); g.translate(c.x, c.y); g.beginPath(); g.rect(0, 0, c.w, c.h); g.clip(); c.draw(g, c.w, c.h); g.restore();
      rects[name] = [c.x / W, 1 - (c.y + c.h) / H, (c.x + c.w) / W, 1 - c.y / H];
    }
  }, { wrap: false, aniso: 8 });
  return { tex, rects };
}
/** plane (w×h, facing +Z) UV-mapped to an atlas rect */
export function decalGeo(rect, w, h) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, rect[0] + uv.getX(i) * (rect[2] - rect[0]), rect[1] + uv.getY(i) * (rect[3] - rect[1]));
  return g;
}

// ───────────────────────────── ash-dust shader patch ─────────────────────────────
const ASH_GLSL = /* glsl */`
float ashHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float ashNoise( vec3 x ) {
  vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( ashHash( i ), ashHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( ashHash( i + vec3( 0.0, 1.0, 0.0 ) ), ashHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
              mix( mix( ashHash( i + vec3( 0.0, 0.0, 1.0 ) ), ashHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( ashHash( i + vec3( 0.0, 1.0, 1.0 ) ), ashHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
}`;
/**
 * Drift ash over a lit material: coverage grows with upward-facing normals, wind-facing normals and low height above the ground,
 * broken up with 3D value noise. Chains onto any existing onBeforeCompile (e.g. env.fog's atmosphere patch).
 * opts: { amount 0..1, color, wind:[x,y,z] (direction the wind blows TOWARD), windStrength, freq, groundY, low (metres of ground-hugging dust) }
 */
export function ashPatch(mat, o = {}) {
  const prev = mat.onBeforeCompile, prevKey = typeof mat.customProgramCacheKey === 'function' ? mat.customProgramCacheKey() : '';
  const wind = new THREE.Vector3(...(o.wind || [-0.8, 0, 0.35])).normalize();
  const uni = {
    uAshCol: { value: new THREE.Color(o.color ?? 0x5b5651) },
    uAshWind: { value: wind },
    uAshK: { value: new THREE.Vector4(o.amount ?? 1, o.freq ?? 1.5, o.groundY ?? -1e4, o.windStrength ?? 1) },
    uAshLow: { value: o.low ?? 2.4 },
  };
  mat.onBeforeCompile = function (shader, renderer) {
    if (prev) prev.call(this, shader, renderer);
    const vs = shader.vertexShader, fs = shader.fragmentShader;
    if (!vs.includes('#include <begin_vertex>') || !fs.includes('#include <normal_fragment_maps>')) return;
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = vs
      .replace('#include <common>', '#include <common>\nvarying vec3 vAshP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  { vec4 ashP4 = vec4( transformed, 1.0 );\n #ifdef USE_INSTANCING\n ashP4 = instanceMatrix * ashP4;\n #endif\n vAshP = ( modelMatrix * ashP4 ).xyz; }');
    shader.fragmentShader = fs
      .replace('#include <common>', `#include <common>\nuniform vec3 uAshCol;\nuniform vec3 uAshWind;\nuniform vec4 uAshK;\nuniform float uAshLow;\nvarying vec3 vAshP;\n${ASH_GLSL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 aN = inverseTransformDirection( normal, viewMatrix );
    float aUp = clamp( aN.y, 0.0, 1.0 );
    float aWd = clamp( dot( aN, -uAshWind ), 0.0, 1.0 );
    float aLow = 1.0 - smoothstep( 0.0, uAshLow, vAshP.y - uAshK.z );
    float aN1 = ashNoise( vAshP * uAshK.y );
    float aN2 = ashNoise( vAshP * uAshK.y * 4.3 + 7.0 );
    float aStr = ashNoise( vec3( vAshP.x * 3.0 + vAshP.z * 3.0, vAshP.y * 0.35, 3.0 ) );
    float aNz = aN1 * 0.55 + aN2 * 0.3 + aStr * 0.25;
    float aCover = aUp * aUp * 1.1 + aWd * aWd * 0.9 * uAshK.w + aLow * 0.55 * ( 1.0 - 0.5 * aUp );
    float aK = smoothstep( 0.30, 0.62, aCover * ( 0.20 + aNz * 1.1 ) ) * uAshK.x;
    diffuseColor.rgb = mix( diffuseColor.rgb, uAshCol * ( 0.7 + 0.6 * aN2 ), aK );
    roughnessFactor = mix( roughnessFactor, 0.97, aK );
    metalnessFactor = mix( metalnessFactor, 0.0, aK );
  }`);
  };
  mat.customProgramCacheKey = () => `${prevKey}|phlAsh1`;
  mat.needsUpdate = true;
  return mat;
}

// ───────────────────────────── small helpers ─────────────────────────────
/** nearest approach of the lava river centre-line to (x,z): { d, x, z, dx, dz } (unit vector from the point to the river) */
export function nearestRiver(river, x, z, zr = 220) {
  let best = { d: Infinity, x: 0, z: 0, dx: 0, dz: 1 };
  for (let k = -zr; k <= zr; k += 2) {
    const zz = z + k, xx = river.cx(zz), d = Math.hypot(xx - x, zz - z);
    if (d < best.d) best = { d, x: xx, z: zz, dx: (xx - x) / (d || 1), dz: (zz - z) / (d || 1) };
  }
  return best;
}

/** shared MLI foil materials (gold Kapton + aluminised silver) built from one crinkle map set */
export function foilMats(kit, seed = 5) {
  const maps = foilMaps(seed, 256);
  const cfg = { map: maps.map, normalMap: maps.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), vertexColors: true, metalness: 0.28, roughness: 0.46 };
  return { gold: kit.std({ ...cfg, color: 0xffd24e }), silver: kit.std({ ...cfg, color: 0xe9eef6 }), maps };
}
