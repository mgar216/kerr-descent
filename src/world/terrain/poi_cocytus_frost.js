// ORPHEUS · Cocytus POIs — frost, rime, icicles and wind-banked snow.
// frostify(mat): chains onto a kit.std() material (after the atmosphere-fog patch) and crusts surfaces facing the wind / pointing up with rime
// (colour → frost white-blue, roughness ↑, metalness ↓, a view-dependent crystal glitter). World-space procedural noise, no textures.
import * as THREE from 'three';
import { smooth, clamp } from './poi_charon_icekit.js';

/** the wind blows TOWARD this ship-space direction (shared with fx.js: starboard crosswind, slightly forward) */
export const WIND_TO = new THREE.Vector3(0.995, 0, -0.10).normalize();

const GLSL_FROST = /* glsl */`
varying vec3 vFW; varying vec3 vFN;
uniform vec3 uFrostDir; uniform vec3 uFrostCol; uniform float uFrostAmt; uniform float uFrostBias; uniform float uFrostSpark; uniform float uFrostRough;
float fHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fHash(i), fHash(i + vec3(1.,0.,0.)), f.x), mix(fHash(i + vec3(0.,1.,0.)), fHash(i + vec3(1.,1.,0.)), f.x), f.y),
             mix(mix(fHash(i + vec3(0.,0.,1.)), fHash(i + vec3(1.,0.,1.)), f.x), mix(fHash(i + vec3(0.,1.,1.)), fHash(i + vec3(1.,1.,1.)), f.x), f.y), f.z);
}
float frostMask() {
  vec3 n = normalize(vFN);
  float wind = dot(n, uFrostDir), up = n.y;
  float n1 = fNoise(vFW * 1.7), n2 = fNoise(vFW * 7.0), n3 = fNoise(vFW * 23.0);
  float cover = wind * 0.85 + max(up, 0.0) * 0.75 - max(-up, 0.0) * 0.9 + (n1 - 0.5) * 0.95 + (n2 - 0.5) * 0.5 + (n3 - 0.5) * 0.28 + uFrostBias;
  return smoothstep(0.12, 0.70, cover) * uFrostAmt;
}
float frostGlint() {
  vec3 v = normalize(vViewPosition);
  return smoothstep(0.935, 1.0, fNoise(vFW * 140.0 + v * 5.0)) * 12.0;
}
`;

/** shared uniforms for every frosted material of one POI build */
export function makeFrost() {
  const U = { uFrostDir: { value: WIND_TO.clone().negate() }, uFrostCol: { value: new THREE.Color(0.78, 0.88, 0.98) } };
  /**
   * opts: amount 0..1 (overall coverage), bias (+ = more frost everywhere; ≥1 ≈ fully snow-covered), rough (frost roughness), sparkle (glitter emissive)
   */
  function frostify(mat, { amount = 1, bias = 0, rough = 0.55, sparkle = 0.10 } = {}) {
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
    const uAmt = { value: amount }, uBias = { value: bias }, uSpark = { value: sparkle }, uRough = { value: rough };
    mat.onBeforeCompile = (shader, renderer) => {
      if (prev) prev.call(mat, shader, renderer);
      Object.assign(shader.uniforms, { uFrostDir: U.uFrostDir, uFrostCol: U.uFrostCol, uFrostAmt: uAmt, uFrostBias: uBias, uFrostSpark: uSpark, uFrostRough: uRough });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFW; varying vec3 vFN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vFW = (modelMatrix * vec4(transformed, 1.0)).xyz; vFN = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + GLSL_FROST)
        .replace('#include <color_fragment>', '#include <color_fragment>\n float fMask = frostMask(); diffuseColor.rgb = mix(diffuseColor.rgb, uFrostCol * (0.86 + 0.24 * fNoise(vFW * 31.0)), fMask);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, uFrostRough, fMask);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor *= (1.0 - fMask);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += fMask * uFrostSpark * frostGlint() * uFrostCol;');
    };
    mat.customProgramCacheKey = () => prevKey + '|frost';
    mat.needsUpdate = true;
    return mat;
  }
  return { frostify, uniforms: U };
}

/**
 * Icicle cones hanging from attachment points. list: [{ p:[x,y,z] top (slot-local), len, r, tilt? }] → added into `batch` (ice material).
 */
export function addIcicles(batch, list, rng, THREE_ = THREE) {
  for (const q of list) {
    const len = q.len, r = q.r ?? 0.02;
    const g = new THREE_.ConeGeometry(r, len, 6, 1, true);
    batch.add(g, { p: [q.p[0], q.p[1] - len / 2, q.p[2]], r: [Math.PI + (rng() - 0.5) * 0.12, rng() * 6.28, (rng() - 0.5) * 0.12], color: 0xffffff, uv: 0 });
  }
}

/** a string of icicles along a straight edge from a to b (slot-local), density per metre, hanging below the edge */
export function icicleRow(a, b, perM, lenMin, lenMax, rng, out = []) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.round(L * perM));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.2 + rng() * 0.6) / n, big = rng() > 0.7;
    out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], len: lenMin + rng() * (lenMax - lenMin) * (big ? 1.5 : 1), r: 0.012 + rng() * 0.022 });
  }
  return out;
}

/**
 * Wind-banked snow drift: a soft teardrop mound rising against an obstacle and tapering upwind (toward `dir`, a unit [x,z] slot-local direction).
 * Heights follow the terrain; sastrugi ripples run across the wind. o: { x, z (anchor at the wall, slot-local), dir:[dx,dz], len, wid, h, seed }
 * Returns world-space geometry (add straight to the group).
 */
export function driftGeo(fr, o) {
  const { x, z, dir, len = 6, wid = 4, h = 1.6, seed = 1 } = o, nu = Math.max(22, Math.min(46, Math.round(len / 0.19))), nv = 18, env = fr.env;
  const pos = [], idx = [], px = -dir[1], pz = dir[0];                      // across-wind axis
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7 + seed * 17.3) * 43758.5453; return s - Math.floor(s); };
  const vn = (a, b) => { const ia = Math.floor(a), ib = Math.floor(b), fa = a - ia, fb = b - ib, u = fa * fa * (3 - 2 * fa), v = fb * fb * (3 - 2 * fb); return (hash(ia, ib) * (1 - u) + hash(ia + 1, ib) * u) * (1 - v) + (hash(ia, ib + 1) * (1 - u) + hash(ia + 1, ib + 1) * u) * v; };
  for (let i = 0; i <= nu; i++) {
    const t = i / nu, u = t * len;
    const rise = Math.sin(Math.min(1, t / 0.16) * Math.PI / 2), fall = Math.pow(1 - smooth(0.12, 1.0, t), 1.35), prof = rise * fall;
    const hw = wid * 0.5 * (1 - 0.5 * t) * (0.9 + 0.2 * vn(t * 6, seed));
    for (let j = 0; j <= nv; j++) {
      const s = j / nv * 2 - 1, v = s * hw * 1.04, g = Math.max(0, 1 - s * s), body = Math.pow(g, 1.4);
      const rip = 0.03 * Math.sin((u * 3.1 + v * 0.7 + vn(u * 0.8, v * 0.8) * 3) * 5.2) * Math.sqrt(prof) + 0.05 * (vn(u * 1.3, v * 1.3 + 5) - 0.5) * body;
      const hh = Math.max(0, h * prof * body + rip * body);
      const lx = x + dir[0] * u + px * v, lz = z + dir[1] * u + pz * v, wx = fr.wx(lx, lz), wz = fr.wz(lx, lz);
      pos.push(wx, env.groundY(wx, wz) + hh - 0.035, wz);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // computeVertexNormals needs an upward-facing winding; flip if the first triangle faces down
  if (g.attributes.normal.getY(0) < 0 && g.attributes.normal.getY(Math.floor(g.attributes.normal.count / 2)) < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
  return g;
}
/**
 * Soft warm-exhaust plume: THREE.Points with a tiny ShaderMaterial (positions animated entirely in the vertex shader from uTime, log-depth safe).
 * emitters: [{ p: THREE.Vector3 (ship space), n: particle count, rise, spread, size }] → { points, update(t, viewH) }
 */
export function steamPlume(emitters, wind, rng) {
  const pos = [], seed = [], prm = [];
  for (const e of emitters) for (let i = 0; i < e.n; i++) { pos.push(e.p.x, e.p.y, e.p.z); seed.push(rng(), 0.7 + rng() * 0.6, rng()); prm.push(e.rise ?? 2.4, e.spread ?? 0.3, e.size ?? 0.5); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 3)); g.setAttribute('aPrm', new THREE.Float32BufferAttribute(prm, 3));
  const u = { uTime: { value: 0 }, uViewH: { value: 900 }, uWind: { value: new THREE.Vector3(wind.x, 0, wind.z).multiplyScalar(2.6) }, uCol: { value: new THREE.Color(0.86, 0.92, 0.98) } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute vec3 aSeed; attribute vec3 aPrm; uniform float uTime; uniform float uViewH; uniform vec3 uWind; varying float vA;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        float life = fract(uTime * 0.27 + aSeed.x);
        vec3 p = position + vec3(0.0, life * aPrm.x, 0.0) + uWind * life * life * 2.2
               + vec3(sin(aSeed.z * 6.283 + life * 3.1), 0.0, cos(aSeed.z * 6.283 + life * 2.3)) * aPrm.y * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aPrm.z * aSeed.y * (0.4 + life * 1.6) * projectionMatrix[1][1] * uViewH * 0.5 / max(-mv.z, 0.1), 1.0, 160.0);
        vA = (1.0 - life) * smoothstep(0.0, 0.1, life) * 0.55;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; varying float vA;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        float r = length(gl_PointCoord - 0.5) * 2.0, a = smoothstep(1.0, 0.0, r); a *= a;
        gl_FragColor = vec4(uCol, a * vA);
      }`,
  });
  const points = new THREE.Points(g, m); points.frustumCulled = false; points.castShadow = false; points.renderOrder = 5;
  return { points, update(t, viewH) { u.uTime.value = t; if (viewH) u.uViewH.value = viewH; } };
}
export { clamp };
