// LYRA core column: hex/triangulated lattice (one merged mesh, custom ShaderMaterial: energy waves travel up, breathing pulse, mode-aware),
// inner spindle, haze, instanced rotating rings/discs, rising motes, floor projection ring. Derelict (THEA): same lattice, dead — see thea() in science_corefx.js.
import { FL, CE } from './science_util.js';

export const Y0 = FL + 0.25, Y1 = CE - 0.2;                          // lattice span (plinth top … collar)
const N = 8, K = 9;
const radius = (u) => 0.36 + 0.14 * (2 * u - 1) ** 2;               // hourglass profile (0.50 at the ends, 0.36 waist)

// strut / node lists: struts [a, b, r, kind, phase]; nodes [p, kind, phase]
export function latticeData(cx, cz, R) {
  const struts = [], nodes = [], P = [];
  for (let k = 0; k < K; k++) {
    const u = k / (K - 1), y = Y0 + (Y1 - Y0) * u, r = radius(u), ring = [];
    for (let j = 0; j < N; j++) { const a = (j + (k % 2) * 0.5) * Math.PI * 2 / N; ring.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]); nodes.push([ring[j], 1, R()]); }
    P.push(ring);
  }
  for (let k = 0; k < K; k++) for (let j = 0; j < N; j++) {
    struts.push([P[k][j], P[k][(j + 1) % N], 0.0065, 0, R()]);
    if (k < K - 1) {
      const nj = k % 2 === 0 ? [j - 1, j] : [j, j + 1];
      for (const i of nj) struts.push([P[k][j], P[k + 1][(i + N) % N], 0.0055, 0, R()]);
    }
  }
  for (let k = 0; k < K - 2; k += 2) for (let j = 0; j < N; j += 2) struts.push([P[k][j], P[k + 2][j], 0.011, 2, R()]);      // spine rails
  return { struts, nodes };
}

// merged geometry: 5-sided prisms for struts, octahedra for nodes. attributes: aH (0..1 height), aK (kind), aPh (phase)
export function buildGeometry(THREE, data, { drop = null } = {}) {
  const pos = [], aH = [], aK = [], aPh = [], idx = [];
  const hN = (y) => Math.min(1, Math.max(0, (y - Y0) / (Y1 - Y0)));
  const push = (p, k, ph) => { pos.push(p[0], p[1], p[2]); aH.push(hN(p[1])); aK.push(k); aPh.push(ph); return pos.length / 3 - 1; };
  const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3(), U = new THREE.Vector3(), V = new THREE.Vector3();
  data.struts.forEach(([a, b, r, kind, ph], si) => {
    let e = b; if (drop) { const d = drop(si); if (d === 1) return; if (d === 2) e = [a[0] + (b[0] - a[0]) * 0.35, a[1] + (b[1] - a[1]) * 0.35 - 0.04, a[2] + (b[2] - a[2]) * 0.35]; }
    A.set(...a); B.set(...e); D.subVectors(B, A).normalize(); U.set(0, 1, 0); if (Math.abs(D.y) > 0.95) U.set(1, 0, 0); U.cross(D).normalize(); V.crossVectors(D, U);
    const base = pos.length / 3;
    for (let s = 0; s < 2; s++) for (let i = 0; i < 5; i++) { const t = i / 5 * Math.PI * 2, o = s ? e : a; push([o[0] + (Math.cos(t) * U.x + Math.sin(t) * V.x) * r, o[1] + (Math.cos(t) * U.y + Math.sin(t) * V.y) * r, o[2] + (Math.cos(t) * U.z + Math.sin(t) * V.z) * r], kind, ph); }
    for (let i = 0; i < 5; i++) { const i2 = (i + 1) % 5; idx.push(base + i, base + i2, base + 5 + i, base + i2, base + 5 + i2, base + 5 + i); }
  });
  data.nodes.forEach(([p, kind, ph], ni) => {
    if (drop && drop(-1 - ni) === 1) return; const r = 0.024, b = pos.length / 3;
    for (const d of [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]]) push([p[0] + d[0], p[1] + d[1], p[2] + d[2]], kind, ph);
    for (const f of [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]]) idx.push(b + f[0], b + f[1], b + f[2]);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setAttribute('aK', new THREE.Float32BufferAttribute(aK, 1)); g.setAttribute('aPh', new THREE.Float32BufferAttribute(aPh, 1)); g.setIndex(idx);
  return g;
}

const VERT = `#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aH; attribute float aK; attribute float aPh;
varying float vH; varying float vK; varying float vPh;
void main(){ vH = aH; vK = aK; vPh = aPh; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
#include <logdepthbuf_vertex>
}`;
const FRAG = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime; uniform float uLevel; uniform vec3 uTint; uniform float uHaze;
varying float vH; varying float vK; varying float vPh;
void main(){
#include <logdepthbuf_fragment>
  float w1 = 0.5 + 0.5 * sin(6.2831 * (vH * 1.5 - uTime * 0.16) + vPh * 2.0);
  float w2 = pow(0.5 + 0.5 * sin(6.2831 * (vH * 2.2 - uTime * 0.42) + vPh * 0.7), 7.0);
  float breath = 0.78 + 0.22 * sin(uTime * 0.95 + vH * 2.0);
  float g;
  if (uHaze > 0.5) g = (0.03 + 0.07 * w1 + 0.15 * w2) * (0.6 + 0.4 * sin(vPh * 6.2831 + uTime * 0.6)) * uLevel * breath;
  else if (vK > 1.5) g = (0.9 + 1.2 * w1 + 2.4 * w2) * uLevel * breath;
  else if (vK > 0.5) g = (1.3 + 1.2 * w1 + 3.2 * w2) * uLevel * breath;
  else g = (0.45 + 0.65 * w1 + 1.6 * w2) * uLevel * breath;
  vec3 col = mix(uTint, vec3(1.0), clamp(w2 * 0.35, 0.0, 0.5)) * g;
  gl_FragColor = vec4(col, 1.0);
#include <colorspace_fragment>
}`;

export function latticeMaterial(THREE, haze = false) {
  const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uTime: { value: 0 }, uLevel: { value: 1 }, uTint: { value: new THREE.Color(0.15, 0.9, 1.0) }, uHaze: { value: haze ? 1 : 0 } }, toneMapped: false });
  if (haze) { m.transparent = true; m.depthWrite = false; m.blending = THREE.AdditiveBlending; m.side = THREE.DoubleSide; }
  m.userData = { emissive: true };
  return m;
}
