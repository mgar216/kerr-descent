// Shared helpers for the crew-deck prop modules (crew_*.js): matrix-based local frames (compose a prop from primitives in its own
// coordinate system) + a few recipes. Frame local convention: +Y up, the prop's FRONT faces local −Z; rot = yaw number or [pitch,yaw,roll] (YXZ).
import * as THREE from 'three';
import { bevelBoxArrays } from './builder.js';

const V3 = THREE.Vector3, M4 = THREE.Matrix4, Qt = THREE.Quaternion, Eu = THREE.Euler;
const _q = new Qt(), _e = new Eu(0, 0, 0, 'YXZ'), _p = new V3(), _s = new V3();
const AX = { x: new M4().makeRotationZ(Math.PI / 2), z: new M4().makeRotationX(Math.PI / 2) };            // cylinder long axis
const TAX = { y: new M4().makeRotationX(Math.PI / 2), x: new M4().makeRotationY(Math.PI / 2) };          // torus ring axis (default z)

// Room interior faces (wall linings, partitions): x0 = outer lining, x1 = corridor wall; z ranges per room. fl/ce = deck / ceiling.
export const RM = { x0: -3.925, x1: -1.25, fl: -1.2, ce: 1.35, q: [3.075, 7.925], g: [8.075, 13.925], a: [14.075, 17.925] };

const eul = (r) => (typeof r === 'number' ? _e.set(0, r, 0, 'YXZ') : _e.set(r[0], r[1], r[2], 'YXZ'));

export class Frame {
  constructor(kit, pos = [0, 0, 0], rot = 0, parent = null) {
    this.kit = kit;
    this.m = new M4().compose(new V3(pos[0], pos[1], pos[2]), new Qt().setFromEuler(eul(rot || 0).clone()), new V3(1, 1, 1));
    if (parent) this.m.premultiply(parent.m);
  }
  sub(pos, rot = 0) { return new Frame(this.kit, pos, rot, this); }
  P(p) { return _p.set(p[0], p[1], p[2]).applyMatrix4(this.m).toArray(); }                                // local point → world [x,y,z]
  L(p, rot, sc, post) {                                                                                       // local transform → world matrix
    const loc = new M4().compose(_p.set(p[0], p[1], p[2]), rot ? _q.setFromEuler(eul(rot)) : _q.identity(), sc ? (typeof sc === 'number' ? _s.set(sc, sc, sc) : _s.set(sc[0], sc[1], sc[2])) : _s.set(1, 1, 1));
    if (post) loc.multiply(post);
    return loc.premultiply(this.m);
  }
  apply(obj) { this.m.decompose(obj.position, obj.quaternion, obj.scale); obj.updateMatrix(); return obj; }  // place a THREE.Object3D in this frame
  add(mat, geo, p = [0, 0, 0], rot, sc, o = {}) { this.kit.add(mat, geo, { matrix: this.L(p, rot, sc), ext: o.ext }); return this; }
  box(mat, p, s, o = {}) {
    const b = o.bev != null ? o.bev : Math.min(0.012, Math.min(s[0], s[1], s[2]) * 0.28);
    this.kit.arrays(mat, bevelBoxArrays(s[0], s[1], s[2], b), { matrix: this.L(p, o.rot), ext: o.ext }); return this;
  }
  cyl(mat, p, r, h, o = {}) {                                                                                  // axis 'y'|'x'|'z'; rt/rb override top/bottom radius; uvr remaps UVs into an atlas rect
    const g = new THREE.CylinderGeometry(o.rt != null ? o.rt : r, o.rb != null ? o.rb : r, h, o.seg || 16, 1, !!o.open, o.t0 || 0, o.tl || Math.PI * 2);
    if (o.uvr) remapUV(g, o.uvr);
    this.kit.add(mat, g, { matrix: this.L(p, o.rot, o.sc, AX[o.axis]), ext: o.ext }); g.dispose(); return this;
  }
  sph(mat, p, r, o = {}) {                                                                                     // r number or [rx,ry,rz] radii; partial via ps/pl (phi) ts/tl (theta)
    const rr = typeof r === 'number' ? [r, r, r] : r, g = new THREE.SphereGeometry(1, o.seg || 12, o.rs || Math.max(4, (o.seg || 12) >> 1), o.ps || 0, o.pl || Math.PI * 2, o.ts || 0, o.tl || Math.PI);
    if (o.uvr) remapUV(g, o.uvr);
    this.kit.add(mat, g, { matrix: this.L(p, o.rot, rr), ext: o.ext }); g.dispose(); return this;
  }
  tor(mat, p, R, r, o = {}) {                                                                                  // axis 'y' (default) | 'x' | 'z'
    const g = new THREE.TorusGeometry(R, r, o.tube || 8, o.seg || 20, o.arc || Math.PI * 2);
    this.kit.add(mat, g, { matrix: this.L(p, o.rot, o.sc, o.axis === 'z' ? null : TAX[o.axis || 'y']), ext: o.ext }); g.dispose(); return this;
  }
  quad(mat, p, w, h, o = {}) {                                                                                 // plane facing local +Z; o.uv=[u0,v0,u1,v1]
    const g = new THREE.PlaneGeometry(w, h);
    if (o.uv) { const u = g.attributes.uv, [a, b, c, d] = o.uv; u.setXY(0, a, d); u.setXY(1, c, d); u.setXY(2, a, b); u.setXY(3, c, b); }
    this.kit.add(mat, g, { matrix: this.L(p, o.rot), ext: o.ext }); g.dispose(); return this;
  }
  lathe(mat, prof, p = [0, 0, 0], o = {}) {                                                                    // profile [[r,y],…] about local Y
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), o.seg || 20);
    this.kit.add(mat, g, { matrix: this.L(p, o.rot, o.sc), ext: o.ext }); g.dispose(); return this;
  }
  ring(mat, p, rIn, rOut, depth, o = {}) {                                                                     // flat annulus plate, normal local +Z (extruded)
    const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: o.seg || 28 }); g.translate(0, 0, -depth / 2);
    this.kit.add(mat, g, { matrix: this.L(p, o.rot), ext: o.ext }); g.dispose(); return this;
  }
  beam(mat, a, b, w, h, o = {}) { this.kit.beam(mat, this.P(a), this.P(b), w, h, { bev: o.bev != null ? o.bev : 0, ext: o.ext }); return this; }   // box from local a to b
  tube(mat, pts, r, o = {}) { this.kit.tube(mat, pts.map((q) => this.P(q)), r, { seg: o.seg, rseg: o.rseg || 6, ext: o.ext }); return this; }
}

// kit.screen mounted in a Frame (screen centre at local p; faces local +Z). Own bezel is drawn by the caller.
export function screenIn(kit, F, p, size, res, draw, o = {}) {
  const g = new THREE.Group(); g.name = o.name || `crewScreen.${o.id || ''}`; F.apply(g); kit.root.add(g);
  return kit.screen({ id: o.id, pos: p, size, res, draw, parent: g, bezel: false, alive: o.alive, range: o.range, interval: o.interval, flick: o.flick });
}

// small canvas → CanvasTexture (sRGB). draw(g, w, h); redrawn when web fonts arrive.
export function canvasTex(kit, w, h, draw, o = {}) {
  const c = kit.T.cvs(w, h), g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const go = () => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; };
  go(); if (o.fonts) kit.T.onFontsReady(go);
  return t;
}
// register a textured (own-UV) lit material under `name`
export function texMat(kit, name, map, o = {}) { kit.defMat(name, { tex: () => ({ map }), uv: 'own', color: 0xffffff, rough: 0.7, metal: 0, ...o }); return name; }

// invisible pick proxy for interactables (world-aligned box)
export const hitBox = (c, s, yaw = 0) => ({ c, s, yaw });

// remap a geometry's UVs (0..1) into an atlas rect [u0,v0,u1,v1]
export function remapUV(g, r) {
  const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, r[0] + a.getX(i) * (r[2] - r[0]), r[1] + a.getY(i) * (r[3] - r[1]));
}

// Parametric surface grid (cloth, blankets, cushions): fn(u,v) → [x,y,z] for u,v ∈ [0,1]; winding gives normals ≈ du × dv. uvr = optional atlas rect for the UVs.
export function clothGrid(nu, nv, fn, uvr) {
  const p = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { p.push(...fn(i / nu, j / nv)); uv.push(uvr ? uvr[0] + i / nu * (uvr[2] - uvr[0]) : i / nu, uvr ? uvr[1] + j / nv * (uvr[3] - uvr[1]) : j / nv); }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1, c = a + 1, d = b + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// Lighter, warmer fabric set for the crew rooms (the kit's `fabric*` weave is charcoal and reads black here): crewFab (cream), crewFabO (orange), crewFabB (blue-grey).
export function fabricMats(kit) {
  const weave = canvasTex(kit, 128, 128, (g, w, h) => {
    g.fillStyle = '#d4d7dc'; g.fillRect(0, 0, w, h); const R = kit.rand(0xfab2);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const k = ((x >> 1) + (y >> 1)) & 1, v = (k ? 232 : 205) + (R() - 0.5) * 14; g.fillStyle = `rgb(${v | 0},${(v + 1) | 0},${(v + 4) | 0})`; g.fillRect(x, y, 2, 2); }
  }, { repeat: true });
  texMat(kit, 'crewFab', weave, { uv: 'world', tile: 0.25, color: 0xf3eee2, rough: 1 });
  texMat(kit, 'crewFabO', weave, { uv: 'world', tile: 0.25, color: 0xe8742a, rough: 1 });
  texMat(kit, 'crewFabB', weave, { uv: 'world', tile: 0.25, color: 0x8da4c6, rough: 1 });
  kit.defMat('crewIce', { color: 0xc9e2f4, rough: 0.2, metal: 0, transparent: true, opacity: 0.85, noShadow: true });
  kit.defMat('crewAmberGlass', { color: 0xff9a2a, rough: 0.1, metal: 0, transparent: true, opacity: 0.5, noShadow: true });
}
