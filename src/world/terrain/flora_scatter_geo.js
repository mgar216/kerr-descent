// ORPHEUS · surface · scatter geometry builders (indexed, outward CCW; flat shading comes from screen-space derivatives in the shaders).
//   icoSphereGeo(level)    unit icosphere (rocks: the vertex shader carves it into a random convex polytope)
//   columnClusterGeo()     19 hexagonal basalt columns on a hex lattice (heights/irregular tops come from the vertex shader)
//   crystalClusterGeo(n)   n hexagonal-prism crystals with bevelled pointed tips (aCry = (crystal index, ring role))
//   spireGeo()             one big faceted, twisted ice spire with three leaning satellite shards (CPU-placed InstancedMesh)
import * as THREE from 'three';

const TAU = Math.PI * 2;

function build(pos, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

/** indexed unit icosphere. level 0: 12 verts · 1: 42 · 2: 162 · 3: 642 */
export function icoSphereGeo(level) {
  const t = (1 + Math.sqrt(5)) / 2;
  const nz = (p) => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; };
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nz);
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let l = 0; l < level; l++) {
    const cache = new Map(), nf = [];
    const mid = (a, b) => {
      const k = a < b ? a * 65536 + b : b * 65536 + a; let i = cache.get(k);
      if (i === undefined) { i = v.length; v.push(nz([v[a][0] + v[b][0], v[a][1] + v[b][1], v[a][2] + v[b][2]])); cache.set(k, i); }
      return i;
    };
    for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  for (const tri of f) {   // guarantee outward-CCW winding
    const a = v[tri[0]], b = v[tri[1]], c = v[tri[2]];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nzz = ux * wy - uy * wx;
    if (nx * (a[0] + b[0] + c[0]) + ny * (a[1] + b[1] + c[1]) + nzz * (a[2] + b[2] + c[2]) < 0) { const s = tri[1]; tri[1] = tri[2]; tri[2] = s; }
  }
  return build(v.flat(), f.flat());
}

/** lattice of 19 hexagonal columns (circumradius 1, axial radius 2). position = (cx + ox, y, cz + oz): y = −1 at the buried base, +1 at the top;
 *  aCol = (cx, cz, columnId) where (cx, cz) is the column centre in circumradius units. 13 verts / column (6 base, 6 top, 1 top centre). */
export function columnClusterGeo() {
  const pos = [], col = [], idx = [];
  const SQ3 = Math.sqrt(3), a1 = [1.5, SQ3 / 2], a2 = [0, SQ3];
  let id = 0;
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
    if (Math.abs(q + r) > 2) continue;
    const cx = q * a1[0] + r * a2[0], cz = q * a1[1] + r * a2[1], base = pos.length / 3;
    const R = 0.965;   // thin joint gap between neighbours
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; pos.push(cx + Math.cos(a) * R, -1, cz + Math.sin(a) * R); col.push(cx, cz, id); }
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; pos.push(cx + Math.cos(a) * R, 1, cz + Math.sin(a) * R); col.push(cx, cz, id); }
    pos.push(cx, 1, cz); col.push(cx, cz, id);
    for (let k = 0; k < 6; k++) {
      const k2 = (k + 1) % 6, b0 = base + k, b1 = base + k2, t0 = base + 6 + k, t1 = base + 6 + k2;
      idx.push(b0, t1, b1, b0, t0, t1);       // side quad, outward
      idx.push(base + 12, t1, t0);            // top fan, +Y
    }
    id++;
  }
  const g = build(pos, idx);
  g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(col), 3));
  return g;
}

/** n unit crystals in one geometry. Ring placeholders (the vertex shader assigns y per role and scales/leans/places each crystal):
 *  role 0 = base ring (r 1), 1 = shaft top (r 1), 2 = bevel ring (r .8), 3 = apex. aCry = (crystal index, role). 19 verts / 30 tris per crystal. */
export function crystalClusterGeo(n) {
  const pos = [], cry = [], idx = [];
  const RR = [1, 1, 0.8];
  for (let c = 0; c < n; c++) {
    const base = pos.length / 3;
    for (let role = 0; role < 3; role++) for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; pos.push(Math.cos(a) * RR[role], role, Math.sin(a) * RR[role]); cry.push(c, role); }
    pos.push(0, 3, 0); cry.push(c, 3);
    for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 6; k++) {
      const k2 = (k + 1) % 6, b0 = base + ring * 6 + k, b1 = base + ring * 6 + k2, t0 = base + (ring + 1) * 6 + k, t1 = base + (ring + 1) * 6 + k2;
      idx.push(b0, t1, b1, b0, t0, t1);
    }
    for (let k = 0; k < 6; k++) idx.push(base + 12 + k, base + 18, base + 12 + (k + 1) % 6);   // pyramid tip, outward
  }
  const g = build(pos, idx);
  g.setAttribute('aCry', new THREE.BufferAttribute(new Float32Array(cry), 2));
  return g;
}

/** one faceted ice spire (unit height, unit base radius, y ∈ [−0.2, 1]) with a slightly twisted tip + three leaning satellite shards. */
export function spireGeo(seed = 5) {
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0; s ^= s >>> 13; return (s >>> 8) / 16777216; };
  const pos = [], idx = [];
  const shard = (ox, oz, h, r, lean, leanDir, sides, twist, rings) => {
    const base = pos.length / 3, nr = rings.length;
    for (let i = 0; i < nr; i++) {
      const [yf, rf] = rings[i], y = yf * h, tw = twist * Math.pow(Math.max(yf, 0), 2.4);
      for (let k = 0; k < sides; k++) {
        const a = k * TAU / sides + tw + (rnd() - 0.5) * 0.30;
        const rr = r * rf * (0.80 + 0.40 * rnd());
        let x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        x += Math.cos(leanDir) * lean * y; z += Math.sin(leanDir) * lean * y;
        pos.push(ox + x, y, oz + z);
      }
    }
    for (let i = 0; i < nr - 1; i++) for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides, b0 = base + i * sides + k, b1 = base + i * sides + k2, t0 = base + (i + 1) * sides + k, t1 = base + (i + 1) * sides + k2;
      idx.push(b0, t1, b1, b0, t0, t1);
    }
    // chisel tip: apex slightly off-axis
    const ap = pos.length / 3;
    pos.push(ox + Math.cos(leanDir) * lean * h + (rnd() - 0.5) * r * 0.25, h * 1.0, oz + Math.sin(leanDir) * lean * h + (rnd() - 0.5) * r * 0.25);
    const top = base + (nr - 1) * sides;
    for (let k = 0; k < sides; k++) idx.push(top + k, ap, top + (k + 1) % sides);
  };
  // main spire: slightly flared foot, long taper, necked tip
  shard(0, 0, 1.0, 1.0, 0.0, 0, 5, 0.70, [[-0.2, 1.06], [0.0, 1.0], [0.12, 1.12], [0.30, 0.80], [0.46, 0.84], [0.66, 0.46], [0.84, 0.30], [0.95, 0.12]]);
  for (let i = 0; i < 3; i++) {
    const a = (i + 0.25 + rnd() * 0.5) * TAU / 3, d = 0.78 + 0.25 * rnd(), h = 0.26 + 0.22 * rnd();
    shard(Math.cos(a) * d, Math.sin(a) * d, h, 0.30 + 0.12 * rnd(), 0.30 + 0.25 * rnd(), a, 5, 0.3, [[-0.45, 1.05], [0.0, 1.0], [0.5, 0.72], [0.85, 0.34]]);
  }
  return build(pos, idx);
}
