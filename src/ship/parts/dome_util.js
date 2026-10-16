// Geometry helpers shared by the dome part files (pure functions, no module state).
import * as THREE from 'three';

export const TAU = Math.PI * 2;

// Stair opening in the dome-deck slab (grown by m): true when (x,z) lies inside it.
export const inHole = (S, x, z, m = 0) => x > S.x0 - m && x < S.x1 + m && z > S.holeZ0 - m && z < S.holeZ1 + m;

// Vertex/triangle accumulator; triangles are wound automatically to agree with the vertex normal of their first vertex.
export class Acc {
  constructor() { this.p = []; this.n = []; this.uv = []; this.idx = []; }
  v(x, y, z, nx, ny, nz, u = 0, w = 0) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); return this.p.length / 3 - 1; }
  tri(a, b, c) {
    const p = this.p, n = this.n, ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const ux = p[b * 3] - ax, uy = p[b * 3 + 1] - ay, uz = p[b * 3 + 2] - az, vx = p[c * 3] - ax, vy = p[c * 3 + 1] - ay, vz = p[c * 3 + 2] - az;
    const d = (uy * vz - uz * vy) * n[a * 3] + (uz * vx - ux * vz) * n[a * 3 + 1] + (ux * vy - uy * vx) * n[a * 3 + 2];
    if (d >= 0) this.idx.push(a, b, c); else this.idx.push(a, c, b);
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  get empty() { return this.idx.length === 0; }
  get arrays() { return { p: this.p, n: this.n, uv: this.uv, idx: this.idx }; }
}

const dedupe = (pts) => pts.filter((q, i) => { const o = pts[(i + pts.length - 1) % pts.length]; return Math.hypot(q[0] - o[0], q[1] - o[1]) > 1e-7; });

// Chamfered rectangle in a 2-D (r,y) plane, counter-clockwise. P = centre [r,y]; n,t = unit axes with n × t = +1;
// α ∈ [−aIn, aOut] along n, β ∈ [−b, b] along t; chamfer c.
export function orect(P, n, t, aIn, aOut, b, c = 0) {
  const q = [[-aIn + c, -b], [aOut - c, -b], [aOut, -b + c], [aOut, b - c], [aOut - c, b], [-aIn + c, b], [-aIn, b - c], [-aIn, -b + c]];
  return dedupe(q.map(([a, be]) => [P[0] + n[0] * a + t[0] * be, P[1] + n[1] * a + t[1] * be]));
}
// axis-aligned (r0..r1 × y0..y1) chamfered rectangle
export const rr = (r0, r1, y0, y1, c = 0) => orect([(r0 + r1) / 2, (y0 + y1) / 2], [1, 0], [0, 1], (r1 - r0) / 2, (r1 - r0) / 2, (y1 - y0) / 2, c);

// Surface of revolution about +Y of a closed CCW polygon [[r,y],…], swept a0→a1 (x = r·cos a, z = r·sin a).
// Hard edges between profile edges, smooth around the sweep; partial sweeps get flat end caps. Returns {p,n,uv,idx}.
export function sweep(profile, a0 = 0, a1 = TAU, seg = 48) {
  const A = new Acc(), np = profile.length, full = Math.abs(a1 - a0 - TAU) < 1e-6;
  for (let e = 0; e < np; e++) {
    const P0 = profile[e], P1 = profile[(e + 1) % np], dx = P1[0] - P0[0], dy = P1[1] - P0[1], len = Math.hypot(dx, dy);
    if (len < 1e-7) continue;
    const nr = dy / len, ny = -dx / len; let prev = null;
    for (let s = 0; s <= seg; s++) {
      const a = a0 + (a1 - a0) * s / seg, c = Math.cos(a), sn = Math.sin(a);
      const ia = A.v(P0[0] * c, P0[1], P0[0] * sn, nr * c, ny, nr * sn, s / seg, 0), ib = A.v(P1[0] * c, P1[1], P1[0] * sn, nr * c, ny, nr * sn, s / seg, 1);
      if (prev) A.quad(prev[0], prev[1], ib, ia);
      prev = [ia, ib];
    }
  }
  if (!full) {
    const tris = THREE.ShapeUtils.triangulateShape(profile.map(([r, y]) => new THREE.Vector2(r, y)), []);
    for (const [ang, sg] of [[a0, -1], [a1, 1]]) {
      const c = Math.cos(ang), sn = Math.sin(ang), ids = profile.map(([r, y]) => A.v(r * c, y, r * sn, -sn * sg, 0, c * sg, r, y));
      for (const [i, j, k] of tris) A.tri(ids[i], ids[j], ids[k]);
    }
  }
  return A.arrays;
}

// Matrix with columns ex,ey,ez and translation o (right-handed frames only)
export const frameM = (o, ex, ey, ez) => new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(o);

// Flat strip facing +y along the segment (x0,z0)→(x1,z1), width w, at height y (appended to Acc A)
export function flatSeg(A, x0, z0, x1, z1, w, y) {
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
  const a = A.v(x0 + nx, y, z0 + nz, 0, 1, 0), b = A.v(x1 + nx, y, z1 + nz, 0, 1, 0), c = A.v(x1 - nx, y, z1 - nz, 0, 1, 0), d = A.v(x0 - nx, y, z0 - nz, 0, 1, 0);
  A.quad(a, b, c, d);
}
// Flat annular arc strip (radius r0..r1, angles a0..a1) centred (cx,cz) facing +y; steps whose centre satisfies skip(x,z) are omitted
export function flatArc(A, cx, cz, r0, r1, a0, a1, y, seg, skip) {
  const rm = (r0 + r1) / 2;
  for (let s = 0; s < seg; s++) {
    const t0 = a0 + (a1 - a0) * s / seg, t1 = a0 + (a1 - a0) * (s + 1) / seg, tm = (t0 + t1) / 2;
    if (skip && skip(cx + rm * Math.cos(tm), cz + rm * Math.sin(tm))) continue;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    A.quad(A.v(cx + r0 * c0, y, cz + r0 * s0, 0, 1, 0), A.v(cx + r1 * c0, y, cz + r1 * s0, 0, 1, 0), A.v(cx + r1 * c1, y, cz + r1 * s1, 0, 1, 0), A.v(cx + r0 * c1, y, cz + r0 * s1, 0, 1, 0));
  }
}
