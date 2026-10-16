// Shared helpers for the gear modules (gear_legs / gear_ramp / gear_hatch):
//  Part       – moving-part builder (kit-like primitives kept in LOCAL coordinates, merged per material) → meshes / instances
//  telescope  – instanced hydraulic links (outer tube + chrome rod between two moving points), one draw call per material
import * as THREE from 'three';
import { MeshBuilder, bevelBoxArrays, placement, extrudePoly } from './builder.js';

const V3 = THREE.Vector3, M4 = THREE.Matrix4, Q = THREE.Quaternion;
export const D2R = Math.PI / 180;
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
const Y_AXIS = new V3(0, 1, 0);

export class Part {
  constructor(kit) { this.kit = kit; this.map = new Map(); this._m = new M4(); }
  _b(mat) {
    let b = this.map.get(mat);
    if (!b) {
      const m = this.kit.mat(mat), world = m.userData && m.userData.uv === 'world';
      b = new MeshBuilder(world ? 'world' : 'own', world ? 1 / (m.userData.tile || 1) : 1); this.map.set(mat, b);
    }
    return b;
  }
  add(mat, geo, o = {}) { this._b(mat).addGeometry(geo, placement(o, this._m)); return this; }
  box(mat, c, s, o = {}) {
    const bev = o.bev != null ? o.bev : Math.min(0.012, Math.min(s[0], s[1], s[2]) * 0.28);
    const a = bevelBoxArrays(s[0], s[1], s[2], bev);
    this._b(mat).addArrays(a.p, a.n, a.uv, a.idx, placement({ pos: c, rot: o.rot, quat: o.quat }, this._m)); return this;
  }
  cyl(mat, c, r, h, o = {}) {
    const g = new THREE.CylinderGeometry(o.rt != null ? o.rt : r, o.rb != null ? o.rb : r, h, o.seg || 20, 1, !!o.open);
    const rot = o.axis === 'x' ? [0, 0, Math.PI / 2] : o.axis === 'z' ? [Math.PI / 2, 0, 0] : (o.rot || [0, 0, 0]);
    this.add(mat, g, { pos: c, rot, quat: o.quat }); g.dispose(); return this;
  }
  sphere(mat, c, r, o = {}) {
    const g = new THREE.SphereGeometry(r, o.seg || 16, Math.max(6, (o.seg || 16) >> 1));
    this.add(mat, g, { pos: c, scale: [o.sx || 1, o.sy || 1, o.sz || 1] }); g.dispose(); return this;
  }
  torus(mat, c, R, r, o = {}) {
    const g = new THREE.TorusGeometry(R, r, o.tube || 8, o.seg || 28);
    const rot = o.axis === 'x' ? [0, Math.PI / 2, 0] : o.axis === 'z' ? [0, 0, 0] : [Math.PI / 2, 0, 0];
    this.add(mat, g, { pos: c, rot, quat: o.quat }); g.dispose(); return this;
  }
  // cylinder (default) or box ('box') of radius r between two points
  between(mat, a, b, r, o = {}) {
    const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = d.length(); if (len < 1e-5) return this;
    const q = new Q().setFromUnitVectors(Y_AXIS, d.normalize()), mid = A.add(B).multiplyScalar(0.5);
    if (o.box) return this.box(mat, [mid.x, mid.y, mid.z], [r * 2, len, r * (o.depth || 2)], { quat: q, bev: o.bev });
    const g = new THREE.CylinderGeometry(r, r, len, o.seg || 12, 1);
    this.add(mat, g, { pos: [mid.x, mid.y, mid.z], quat: q }); g.dispose(); return this;
  }
  // polygon prism: pts in local XY, thickness along local Z (centred), optional placement
  extrude(mat, pts, depth, o = {}) { const g = extrudePoly(pts, depth, o.bevel || 0); this.add(mat, g, { pos: o.pos, rot: o.rot, quat: o.quat }); g.dispose(); return this; }
  // one BufferGeometry per material
  build() { const out = []; for (const [mat, b] of this.map) if (!b.empty) out.push([mat, b.build()]); return out; }
  // standalone meshes (one per material) inside `parent`
  meshes(parent, name, o = {}) {
    return this.build().map(([mat, geo]) => this.kit.mesh(geo, mat, { parent, ext: o.ext !== false, name: `${name}.${mat}`, cast: o.cast }));
  }
  // InstancedMesh per material → { count, ims, set(i, matrix), commit() }
  instanced(count, name, o = {}) {
    const kit = this.kit, ims = [];
    for (const [mat, geo] of this.build()) {
      const m = kit.mat(mat), em = m.userData && m.userData.emissive, gl = m.userData && m.userData.glass;
      const im = new THREE.InstancedMesh(geo, m, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.name = `${name}.${mat}.ext`;
      im.castShadow = o.cast != null ? o.cast : (!em && !gl); im.receiveShadow = !em;
      for (let i = 0; i < count; i++) im.setMatrixAt(i, _ident);
      kit.root.add(im); ims.push(im);
    }
    return { count, ims, set(i, mat4) { for (const im of ims) im.setMatrixAt(i, mat4); }, commit() { for (const im of ims) im.instanceMatrix.needsUpdate = true; } };
  }
}
const _ident = new M4();

// Instanced telescoping links: `count` links, each = hull-side tube (radius rT) + chrome rod (radius rR) between P and Q.
export function telescope(kit, count, name, { tubeMat = 'metal', rodMat = 'steel', seg = 14 } = {}) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, seg, 1);
  const mk = (mat, nm) => {
    const im = new THREE.InstancedMesh(geo, kit.mat(mat), count);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.name = `${name}.${nm}.ext`;
    for (let i = 0; i < count; i++) im.setMatrixAt(i, _ident);
    kit.root.add(im); return im;
  };
  const tube = mk(tubeMat, 'tube'), rod = mk(rodMat, 'rod');
  const m = new M4(), q = new Q(), p = new V3(), s = new V3(), d = new V3();
  const put = (im, i, c, len, r) => { s.set(r, len, r); im.setMatrixAt(i, m.compose(c, q, s)); };
  return {
    // P: tube end (fixed side), Qp: rod end (moving side)
    set(i, P, Qp, rT, rR, over = 0.16) {
      d.subVectors(Qp, P); const dist = Math.max(d.length(), 1e-4); d.multiplyScalar(1 / dist); q.setFromUnitVectors(Y_AXIS, d);
      const lt = Math.max(0.18, dist * 0.5 + over), lr = Math.max(0.18, dist * 0.5 + over);
      put(tube, i, p.copy(P).addScaledVector(d, lt / 2), lt, rT);
      put(rod, i, p.copy(Qp).addScaledVector(d, -lr / 2), lr, rR);
    },
    commit() { tube.instanceMatrix.needsUpdate = true; rod.instanceMatrix.needsUpdate = true; },
  };
}
