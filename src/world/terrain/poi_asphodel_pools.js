// ORPHEUS · asphodel · Grey Shore · tide pools (slot `pools`, padR 11): a wet black rock shelf (terraced slabs, polygonal cracks, wet gloss) with seven clear pools
// (animated ripples + caustics on pale sand floors), pale silver-grey fronds that sway, shells + pebbles, sampling stakes with tags + transect strings, quadrats,
// a sign, a sample cache and a marker flag with a cyan beacon. The shelf is a mesh laid ON the terrain (pool bowls are carved into the shelf, never below the ground).
// Local frame: origin = slot centre on the pad, +Z toward the ship. Parented in a yawed child group (the root POI group is never offset).
import * as THREE from 'three';
import { Parts, rockG, latheG, weather, frameOf, atlasRegion, makeFlag, makeBeacon, patchMaterial, emblem, clamp, lerp, smooth, noise2, fbm2, TAU } from './poi_asphodel_parts.js';
import { AT_SHORE as AT, shoreAtlas } from './poi_asphodel_decals.js';
import { makeGy, blobGeo } from './poi_asphodel_ground.js';

const DEG = Math.PI / 180, PI = Math.PI;
const C = { white: 0xeceeea, teal: 0x1d8da1, orange: 0xe8631c, steel: 0x8e969c, graphite: 0x2c3135 };
// pool layout in shelf coordinates (u along the shore, v toward the sea): centre, semi-axes, rotation, water depth at the centre
const POOLS_BASE = [
  { u: -0.8, v: 0.5, a: 2.1, b: 1.38, rot: 0.35, d: 0.18 }, { u: 3.0, v: 1.5, a: 1.45, b: 1.0, rot: -0.3, d: 0.15 }, { u: -4.0, v: -0.8, a: 1.25, b: 0.85, rot: 0.9, d: 0.13 },
  { u: 1.0, v: -2.45, a: 1.15, b: 0.82, rot: 0.2, d: 0.16 }, { u: 4.9, v: -1.0, a: 0.85, b: 0.62, rot: 0.6, d: 0.11 }, { u: -2.3, v: 3.3, a: 1.0, b: 0.72, rot: -0.5, d: 0.14 }, { u: 1.0, v: 3.6, a: 0.7, b: 0.54, rot: 0.1, d: 0.1 },
];
POOLS_BASE.forEach((p, i) => { p.c = Math.cos(p.rot); p.s = Math.sin(p.rot); p.floor = 0.03 + 0.012 * (i % 3); p.rr = Math.max(p.a, p.b) * 1.5; });
const AU = 6.9, AV = 4.8;   // shelf semi-axes
const SAND = [0.052, 0.052, 0.058];

// ───────────────────────────── shaders (chained onto the fogged standard material → logdepth chunks included) ─────────────────────────────
const GLSL_NOISE_MINI = /* glsl */ `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`;

function shelfShader(sh, U) {
  sh.uniforms.uTime = U.uTime; sh.uniforms.uSun = U.uSun;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aPW; varying vec2 vPW; varying vec3 vWP;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPW = aPW; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime; uniform vec3 uSun; varying vec2 vPW; varying vec3 vWP;
${GLSL_NOISE_MINI}
vec2 sfTilt = vec2(0.0);
vec3 crackV(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0; vec2 id1 = vec2(0.0);   // x: distance to the nearest cell border, yz: id of the nearest cell
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 g = vec2(float(x), float(y)); vec2 o = vec2(h21(i + g), h21(i + g + 17.0)); float d = length(g + o - f); if (d < d1){ d2 = d1; d1 = d; id1 = i + g; } else if (d < d2) d2 = d; }
  return vec3(d2 - d1, id1); }
float caus(vec2 p, float t){ vec2 a = p * 2.4; float s = 0.0;
  for (int k = 0; k < 2; k++){ float fk = float(k); a += vec2(sin(a.y * 1.3 + t * (0.6 + fk * 0.3)), cos(a.x * 1.1 - t * (0.5 + fk * 0.2))) * 0.6; s += pow(1.0 - abs(sin(a.x + a.y * 0.7 + fk * 2.0)), 7.0); }
  return s * 0.5; }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 cv = crackV(vWP.xz * 0.75); float cr = smoothstep(0.0, 0.065, cv.x); float slab = 0.72 + 0.55 * h21(cv.yz + 5.0);
  vec3 cw = crackV(vWP.xz * 2.6 + 3.0); float cf = smoothstep(0.0, 0.05, cw.x);
  sfTilt = (vec2(h21(cv.yz + 3.3), h21(cv.yz + 7.7)) - 0.5) * 0.16;
  diffuseColor.rgb *= mix(0.5, 1.0, cr) * mix(0.75, 1.0, cf) * slab * (0.84 + 0.3 * vn(vWP.xz * 4.3)) * (1.0 - 0.25 * vPW.x * (1.0 - cr)); }`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.16, vPW.y);')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec2 bp = vWP.xz * 9.0; float b0 = vn(bp); vec2 g = vec2(b0 - vn(bp + vec2(0.35, 0.0)), b0 - vn(bp + vec2(0.0, 0.35)));
  normal = normalize(normal + mat3(viewMatrix) * vec3(g.x * 0.3 + sfTilt.x, 0.0, g.y * 0.3 + sfTilt.y)); }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.42, 0.72, 0.68) * (0.16 * caus(vWP.xz, uTime) * vPW.x * clamp(uSun.y * 1.6, 0.0, 1.0));`);
}
function waterShader(sh, U) {
  sh.uniforms.uTime = U.uTime;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aEdge; varying float vEdge; varying vec3 vWP;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEdge = aEdge; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime; varying float vEdge; varying vec3 vWP;
${GLSL_NOISE_MINI}
vec2 rip(vec2 p, float t){ vec2 g = vec2(0.0);
  g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 7.0 + t * 1.7) * 0.5; g += vec2(-0.5, 0.85) * cos(dot(p, vec2(-0.5, 0.85)) * 11.0 - t * 2.1) * 0.35;
  g += vec2(0.95, -0.3) * cos(dot(p, vec2(0.95, -0.3)) * 17.0 + t * 2.9) * 0.25; g += (vec2(vn(p * 6.0 + t * 0.35), vn(p * 6.0 - t * 0.3 + 9.0)) - 0.5) * 0.9; return g; }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec2 gr = rip(vWP.xz, uTime) * 0.05; normal = normalize(normal + mat3(viewMatrix) * vec3(gr.x, 0.0, gr.y));
  float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
  diffuseColor.a = mix(0.12, 0.9, fr) * smoothstep(0.0, 0.3, vEdge) * (0.7 + 0.3 * vEdge); }`);
}
function swayShader(sh, U) {
  sh.uniforms.uTime = U.uTime;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSw; uniform float uTime;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
{ float ph = position.x * 3.7 + position.z * 2.9; transformed.x += sin(uTime * 1.3 + ph) * 0.045 * aSw; transformed.z += cos(uTime * 1.1 + ph * 1.3) * 0.04 * aSw; transformed.y += sin(uTime * 1.9 + ph) * 0.012 * aSw; }`);
}
const flipUp = (g, y0idx = 0) => {   // make sure a ground-ish mesh faces up (the (u,v) frame may be mirrored)
  const nr = g.attributes.normal; let sy = 0; for (let i = y0idx; i < nr.count; i += 7) sy += nr.getY(i);
  if (sy < 0) { const ia = g.index.array; for (let i = 0; i < ia.length; i += 3) { const t = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = t; } g.computeVertexNormals(); }
  return g;
};

export function buildPools(S, slot) {
  const { env, kit } = S;
  const y0 = env.groundY(slot.x, slot.z), F = frameOf(slot.x, y0, slot.z, slot.yaw), gy = makeGy(env, F, y0, 13, 1);
  // pools must sit ≥ 0.15 m above the sea even if the terrain here is low: lift shelf + bowls + water together (0 on the current terrain)
  const liftSea = env.seaLevelY != null ? clamp(env.seaLevelY + 0.17 - y0 - Math.min(...POOLS_BASE.map((p) => p.floor + p.d)), 0, 0.6) : 0;
  const POOLS = POOLS_BASE.map((p) => ({ ...p, floor: p.floor + liftSea, wl: p.floor + liftSea + p.d }));
  const root = new THREE.Group(); root.name = 'asphodel.pools'; root.position.set(slot.x, y0, slot.z); root.rotation.y = slot.yaw;
  const D = new Parts(), Rk = new Parts(), Cl = new Parts(), Pc = new Parts(), colliders = [], interactables = [], updates = [];
  const at = (lx, ly, lz) => { const [x, z] = F.xz(lx, lz); return new THREE.Vector3(x, y0 + ly, z); };
  const R = {}; for (const k of Object.keys(AT)) R[k] = atlasRegion(AT, k);
  const col = (...boxes) => { for (const b of boxes.flat()) colliders.push(b); };

  // ───────────────────────── shelf frame: u along the shoreline, v toward the sea (local XZ) ─────────────────────────
  const cb = (env.site?.terrain?.coast?.bearing ?? 285) * DEG; let nx = Math.sin(cb), nz = -Math.cos(cb); if (env.features?.coast?.n) [nx, nz] = env.features.coast.n;
  const cyw = Math.cos(slot.yaw), syw = Math.sin(slot.yaw), nLx = nx * cyw - nz * syw, nLz = nx * syw + nz * cyw;
  const NV = [nLx, nLz], TV = [-nLz, nLx];
  const toXZ = (u, v) => [u * TV[0] + v * NV[0], u * TV[1] + v * NV[1]], toUV = (x, z) => [x * TV[0] + z * TV[1], x * NV[0] + z * NV[1]];
  const poolPt = (p, a, q) => { const ex = Math.cos(a) * p.a * q, ey = Math.sin(a) * p.b * q; return toXZ(p.u + ex * p.c - ey * p.s, p.v + ex * p.s + ey * p.c); };   // point at angle a, normalised radius q of a pool

  /** shelf height field at (u, v) → shared record { h (above the terrain), edge, inW (under water 0..1), wet, pool, q } */
  const fld = { h: 0, edge: 0, inW: 0, wet: 0, pool: -1, q: 9 };
  const shelf = (u, v) => {
    const wob = 1 + 0.2 * (fbm2(u * 0.26 + 11, v * 0.26 + 3, 3, 5) * 2 - 1), s = Math.hypot(u / AU, v / AV) / wob, edge = 1 - smooth(0.6, 1.0, s);
    const n1 = fbm2(u * 0.33 + 7, v * 0.33 + 2, 4, 9), n2 = fbm2(u * 2.3 + 1, v * 2.3 + 8, 3, 4), t = n1 * 3.2, tf = Math.floor(t);
    let h = (0.27 + liftSea + 0.045 * (tf + smooth(0.0, 0.3, t - tf)) + 0.03 * (n2 - 0.5) * 2) * smooth(0.0, 1.0, edge);
    const h0 = h; let best = -1, bq = 9;
    for (let i = 0; i < POOLS.length; i++) {
      const p = POOLS[i], du = u - p.u, dv = v - p.v; if (du * du + dv * dv > p.rr * p.rr) continue;
      const x = du * p.c + dv * p.s, y = -du * p.s + dv * p.c, w = 1 + 0.22 * (fbm2(x * 1.2 + i * 7.3, y * 1.2 + i * 3.1, 2, 21 + i) * 2 - 1), q = Math.hypot(x / p.a, y / p.b) / w;
      if (q > 1.25) continue;
      const bowl = p.floor + Math.max(h0 - p.floor, 0.12) * smooth(0.42, 1.02, q);
      if (bowl < h) h = bowl;
      h += 0.04 * Math.exp(-(((q - 1.03) / 0.13) ** 2)) * edge;
      if (q < bq) { bq = q; best = i; }
    }
    fld.h = h; fld.edge = edge; fld.pool = best; fld.q = bq;
    fld.inW = best >= 0 && bq < 1.1 ? 1 - smooth(POOLS[best].wl - 0.05, POOLS[best].wl + 0.015, h) : 0;
    fld.wet = clamp(Math.max(fld.inW, smooth(-3.5, 3.5, v) * 0.75 + (n2 - 0.5) * 0.5 + (bq < 1.5 ? (1 - smooth(1.0, 1.5, bq)) * 0.5 : 0)), 0, 1);
    return fld;
  };
  const topLocal = (lx, lz) => { const [u, v] = toUV(lx, lz); return gy(lx, lz) + shelf(u, v).h; };

  // ───────────────────────── shelf mesh: rotated (u, v) grid, lazily indexed; RGBA vertex colour (alpha feathers the rim into the terrain) + (pool, wet) attributes ─────────────────────────
  const shelfGeos = (() => {
    const STEP = 0.25, nu = Math.ceil(2 * (AU + 0.9) / STEP), nv = Math.ceil(2 * (AV + 0.9) / STEP), remap = new Int32Array((nu + 1) * (nv + 1)).fill(-1), alV = new Float32Array((nu + 1) * (nv + 1));
    const pos = [], cl = [], pw = [], core = [], feather = [];
    const vtx = (i, j) => {
      const k = j * (nu + 1) + i; if (remap[k] >= 0) return remap[k];
      const u = -AU - 0.9 + i * STEP, v = -AV - 0.9 + j * STEP, f = shelf(u, v), [lx, lz] = toXZ(u, v), n = fbm2(u * 1.7 + 5, v * 1.7, 3, 12), nn = noise2(u * 6, v * 6, 3);
      const wet = f.wet, dry = lerp(0.05, 0.028, wet), lich = smooth(0.66, 0.8, fbm2(u * 1.9 + 3, v * 1.9, 3, 31)) * (1 - wet * 0.6);
      let r = dry * (0.8 + 0.45 * n + 0.2 * nn), g = r * 1.03, b = r * 1.12;
      r += lich * 0.1; g += lich * 0.105; b += lich * 0.095;                                                                     // pale lichen / barnacle crust on the dry rock
      const sk = f.inW * smooth(0.25, 0.9, f.inW) * 0.85, sc = 0.115 + nn * 0.05; r = lerp(r, sc, sk); g = lerp(g, sc * 1.03, sk); b = lerp(b, sc * 1.07, sk);   // pale sandy pool floors
      const alg = noise2(u * 3, v * 3, 7) > 0.62 ? smooth(0.0, 0.5, f.inW) : 0; r *= 1 - 0.3 * alg; g *= 1 - 0.05 * alg;                                    // algae patches on the floor
      const al = smooth(0.0, 0.5, f.edge);
      pos.push(lx, gy(lx, lz) + f.h + 0.008, lz); cl.push(r, g, b, al); pw.push(f.inW, f.wet * smooth(0.05, 0.4, f.edge));
      alV[k] = al; return (remap[k] = (pos.length / 3) - 1);
    };
    const inside = (a, b) => Math.hypot((-AU - 0.9 + a * STEP) / AU, (-AV - 0.9 + b * STEP) / AV) < 1.35;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      if (!(inside(i, j) || inside(i + 1, j) || inside(i, j + 1) || inside(i + 1, j + 1))) continue;
      const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i, j + 1), d = vtx(i + 1, j + 1), k = j * (nu + 1) + i, s = alV[k] + alV[k + 1] + alV[k + nu + 1] + alV[k + nu + 2];
      if (s <= 0.001) continue;
      (Math.min(alV[k], alV[k + 1], alV[k + nu + 1], alV[k + nu + 2]) > 0.999 ? core : feather).push(a, c, b, b, c, d);
    }
    const all = new THREE.BufferGeometry(); all.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); all.setAttribute('color', new THREE.Float32BufferAttribute(cl, 4)); all.setAttribute('aPW', new THREE.Float32BufferAttribute(pw, 2));
    all.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(core.concat(feather), 1) : new THREE.Uint16BufferAttribute(core.concat(feather), 1)); all.computeVertexNormals(); flipUp(all);
    const ia = all.index.array, mk = (index) => { const g = new THREE.BufferGeometry(); for (const key of ['position', 'normal', 'color', 'aPW']) g.setAttribute(key, all.attributes[key]); g.setIndex(new THREE.BufferAttribute(index, 1)); return g; };
    return [mk(ia.slice(0, core.length)), mk(ia.slice(core.length))];
  })();
  const U = { uTime: S.uTime, uSun: { value: env.sunDir } };
  const shelfMat = (feather) => patchMaterial(kit.std({ color: 0xffffff, vertexColors: true, roughness: 0.62, metalness: 0.02, envMapIntensity: 0.9, transparent: true, depthWrite: !feather }), 'poolShelf', (sh) => shelfShader(sh, U));   // same program for both
  const shelfMesh = new THREE.Mesh(shelfGeos[0], shelfMat(false)); shelfMesh.name = 'shelf'; shelfMesh.receiveShadow = true; shelfMesh.castShadow = false; root.add(shelfMesh);
  const shelfRim = new THREE.Mesh(shelfGeos[1], shelfMat(true)); shelfRim.name = 'shelf-rim'; shelfRim.renderOrder = 1; shelfRim.receiveShadow = true; shelfRim.castShadow = false; root.add(shelfRim);
  {   // wet, glossy sand skirt on the seaward side of the shelf, fading into the dry beach
    const [wx, wz] = toXZ(0.5, 5.2), wg = blobGeo({ gy, cx: wx, cz: wz, rx: 9.5, rz: 5.4, rot: Math.atan2(-TV[1], TV[0]), rings: 9, segs: 40, wob: 0.18, seed: 7, lift: 0.006, uvS: 1,
      col: (x, z, u) => { const k = 0.34 + 0.26 * u + 0.1 * noise2(x * 2.1, z * 2.1, 4); return [SAND[0] * k, SAND[1] * k, SAND[2] * k * 1.06]; }, alpha: (u) => (1 - smooth(0.3, 1.0, u)) * 0.92 });
    const wm = S.once('m.wetSand', () => kit.std({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.2, metalness: 0, envMapIntensity: 1.0 }));
    const wet = new THREE.Mesh(wg, wm); wet.name = 'wet-sand'; wet.renderOrder = 0; wet.receiveShadow = true; root.add(wet);
  }

  // ───────────────────────── water: one polygon per pool, slightly larger than the bowl at its water line (rock hides the overhang) ─────────────────────────
  {
    const pos = [], edge = [], idx = [], segs = 30;
    POOLS.forEach((p, i) => {
      const base = pos.length / 3, [cx, cz] = toXZ(p.u, p.v), wy = gy(cx, cz) + p.wl;
      pos.push(cx, wy, cz); edge.push(1);
      for (let r = 1; r <= 3; r++) for (let s = 0; s < segs; s++) {
        const a = s / segs * TAU, rr = r / 3, ex = Math.cos(a) * p.a * rr, ey = Math.sin(a) * p.b * rr, wob = (1 + 0.22 * (fbm2(ex * 1.2 + i * 7.3, ey * 1.2 + i * 3.1, 2, 21 + i) * 2 - 1)) * (r === 3 ? 1.06 : 1);
        const [lx, lz] = toXZ(p.u + (ex * p.c - ey * p.s) * wob, p.v + (ex * p.s + ey * p.c) * wob); pos.push(lx, wy, lz); edge.push(r === 3 ? 0 : r === 2 ? 0.55 : 1);
      }
      for (let s = 0; s < segs; s++) idx.push(base, base + 1 + (s + 1) % segs, base + 1 + s);
      for (let r = 1; r < 3; r++) for (let s = 0; s < segs; s++) { const a = base + 1 + (r - 1) * segs + s, b = base + 1 + (r - 1) * segs + (s + 1) % segs, c = a + segs, d = b + segs; idx.push(a, b, c, b, d, c); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1)); g.setIndex(idx); g.computeVertexNormals(); flipUp(g);
    const wm = kit.std({ color: 0x0a2c32, roughness: 0.03, metalness: 0.0, transparent: true, depthWrite: false, envMapIntensity: 1.6, emissive: 0x03151a, emissiveIntensity: 0.6 });
    const water = new THREE.Mesh(g, patchMaterial(wm, 'poolWater', (sh) => waterShader(sh, U))); water.name = 'pool-water'; water.renderOrder = 3; water.receiveShadow = false; root.add(water);
  }

  // ───────────────────────── frond life (pale silver-grey ribbons), swaying in the shader ─────────────────────────
  {
    const pos = [], nor = [], cls = [], sw = [], idx = [], rnd = kit.rng('fronds');
    const blade = (x, y, z, dirA, len, wid, th0, curl, tone) => {
      const N = 6, dx = Math.sin(dirA), dz = Math.cos(dirA), sx = dz, sz = -dx, seg = len / N, base = pos.length / 3; let px = x, py = y, pz = z, th = th0;
      for (let i = 0; i <= N; i++) {
        const s = i / N, w = wid * (1 - 0.72 * s) * 0.5, tx = Math.sin(th) * dx, ty = Math.cos(th), tz = Math.sin(th) * dz;
        let nxv = -sz * ty, nyv = sz * tx - sx * tz, nzv = sx * ty; const nl = Math.hypot(nxv, nyv, nzv) || 1; nxv /= nl; nyv /= nl; nzv /= nl;   // (side × tangent)
        const k = tone * (0.6 + 0.55 * s), r = (0.12 + 0.36 * s) * k, g = (0.135 + 0.38 * s) * k, b = (0.14 + 0.37 * s) * k;
        for (const sd of [-1, 1]) { pos.push(px + sx * w * sd, py, pz + sz * w * sd); nor.push(nxv, nyv, nzv); cls.push(r, g, b); sw.push(s * s); }
        px += tx * seg; py += ty * seg; pz += tz * seg; th += curl / N;
      }
      for (let i = 0; i < N; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    };
    const cluster = (lx, lz, yBase, n, hMax, tone) => {
      const out = rnd() * TAU;
      for (let i = 0; i < n; i++) blade(lx + (rnd() - 0.5) * 0.08, yBase, lz + (rnd() - 0.5) * 0.08, out + (rnd() - 0.5) * 2.6, hMax * (0.45 + 0.55 * rnd()), 0.028 + 0.03 * rnd(), 0.05 + 0.5 * rnd(), 0.5 + 1.3 * rnd(), tone * (0.85 + 0.3 * rnd()));
    };
    POOLS.forEach((p, i) => {
      const nR = 4 + (i < 3 ? 2 : 0), nI = 2 + (i < 2 ? 1 : 0);
      for (let k = 0; k < nR; k++) { const [lx, lz] = poolPt(p, rnd() * TAU, 0.88 + rnd() * 0.22); cluster(lx, lz, topLocal(lx, lz) - 0.02, 7 + (rnd() * 5 | 0), 0.2 + 0.2 * rnd(), 1.0); }
      for (let k = 0; k < nI; k++) { const [lx, lz] = poolPt(p, rnd() * TAU, 0.2 + rnd() * 0.5); cluster(lx, lz, topLocal(lx, lz) - 0.01, 8, 0.14 + 0.1 * rnd(), 0.9); }
    });
    for (let k = 0; k < 7; k++) { const u = (rnd() - 0.5) * 11, v = (rnd() - 0.5) * 7; if (Math.hypot(u / AU, v / AV) < 0.85) { const [lx, lz] = toXZ(u, v), f = shelf(u, v); if (f.q > 1.3) cluster(lx, lz, gy(lx, lz) + f.h, 5, 0.16, 0.8); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cls, 3)); g.setAttribute('aSw', new THREE.Float32BufferAttribute(sw, 1));
    g.setIndex(new THREE.Uint16BufferAttribute(idx, 1));
    const fm = patchMaterial(kit.std({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, metalness: 0, envMapIntensity: 0.8 }), 'poolFrond', (sh) => swayShader(sh, U));
    const fronds = new THREE.Mesh(g, fm); fronds.name = 'fronds'; fronds.castShadow = false; fronds.receiveShadow = true; root.add(fronds);
  }

  // ───────────────────────── boulders, pebbles, shells, barnacles ─────────────────────────
  {
    const rnd = kit.rng('pebbles');
    for (let i = 0; i < 9; i++) {   // boulders on / around the shelf edge
      const a = rnd() * TAU, rr = 0.82 + rnd() * 0.32, [lx, lz] = toXZ(Math.cos(a) * AU * rr, Math.sin(a) * AV * rr), s = 0.22 + rnd() * 0.42, k = 0.55 + rnd() * 0.5;
      Rk.add('rock', rockG(i * 3.7 + 1, { detail: 2, rough: 0.32, sy: 0.62, sx: 1 + rnd() * 0.4, flat: 0.5, pos: [lx, topLocal(lx, lz) + s * 0.1, lz], rot: [0, rnd() * TAU, 0], sc: s }), [0.05 * k, 0.052 * k, 0.058 * k]);
    }
    for (let i = 0; i < 46; i++) {   // pebbles, denser around pools
      const p = POOLS[i % POOLS.length], [lx, lz] = poolPt(p, rnd() * TAU, 0.5 + rnd() * 1.1), s = 0.018 + rnd() * rnd() * 0.07, tone = rnd();
      const c = tone < 0.62 ? [0.035 + rnd() * 0.03, 0.037 + rnd() * 0.03, 0.042 + rnd() * 0.03] : tone < 0.9 ? [0.16 + rnd() * 0.08, 0.16 + rnd() * 0.08, 0.15 + rnd() * 0.07] : [0.17, 0.1, 0.07];
      Rk.add('rock', rockG(i * 1.9 + 4, { detail: 1, rough: 0.2, sy: 0.6, sx: 1 + rnd() * 0.5, pos: [lx, topLocal(lx, lz) + s * 0.2, lz], rot: [0, rnd() * TAU, 0], sc: s }), c);
    }
    const turret = [[0.0001, 0], [0.02, 0], [0.026, 0.012], [0.018, 0.017], [0.022, 0.03], [0.013, 0.035], [0.016, 0.05], [0.004, 0.066], [0.0001, 0.07]];
    for (let i = 0; i < 26; i++) {   // shells: turret + bivalve
      const p = POOLS[(i * 3) % POOLS.length], [lx, lz] = poolPt(p, rnd() * TAU, 0.4 + rnd() * 1.2), s = 0.8 + rnd() * 1.6, ty = topLocal(lx, lz), tone = 0.5 + 0.25 * rnd(), c = [tone * 1.02, tone * 0.98, tone * 0.93];
      if (i % 3) Rk.add('rock', latheG(turret, 9, [lx, ty + 0.012 * s, lz], [PI / 2 + (rnd() - 0.5) * 0.7, rnd() * TAU, (rnd() - 0.5) * 0.4], s), c);
      else Rk.add('rock', new THREE.SphereGeometry(0.03 * s, 10, 6, 0, TAU, 0, PI / 2).scale(1, 0.4, 0.8).rotateY(rnd() * TAU).translate(lx, ty + 0.004, lz), c);
    }
    for (let i = 0; i < 70; i++) {   // barnacle crust: tiny pale cones on the dry shelf
      const u = (rnd() - 0.5) * 2 * AU * 0.8, v = (rnd() - 0.5) * 2 * AV * 0.8, f = shelf(u, v); if (f.q < 1.15 || f.edge < 0.3) continue;
      const [lx, lz] = toXZ(u, v); Rk.add('rock', new THREE.ConeGeometry(0.012 + rnd() * 0.01, 0.025, 6).translate(lx, gy(lx, lz) + f.h + 0.012, lz), [0.26, 0.26, 0.24]);
    }
  }

  // ───────────────────────── survey kit: sampling stakes with tags, transect strings, quadrats ─────────────────────────
  const tagUV = (i) => { const [u0, v0, u1, v1] = R.tags, w = (u1 - u0) / 8; return [u0 + w * i, v0, u0 + w * (i + 1), v1]; };
  const stakes = [];
  POOLS.forEach((p, i) => {
    const [lx, lz] = toXZ(p.u + (i % 2 ? 0.5 : -0.5), p.v - p.b - 0.35), ty = topLocal(lx, lz), h = 0.7 + (i % 3) * 0.12;
    stakes.push([lx, lz, ty, h]);
    for (let b = 0; b < 5; b++) Cl.cyl('metal', 0.013, 0.013, h / 5, 7, [lx, ty + h / 10 + b * h / 5, lz], null, b % 2 ? C.white : C.orange);
    Cl.cyl('metal', 0.02, 0.014, 0.02, 7, [lx, ty + h + 0.005, lz], null, C.graphite);
    const tilt = (i - 3) * 0.12, tx = lx + 0.03, tz = lz + 0.012, tyy = ty + h - 0.2;   // hanging tag: backing plate + front / back decals
    Cl.between('metal', [lx, ty + h - 0.02, lz], [tx, tyy + 0.04, tz], 0.0025, 3, C.graphite);
    Cl.box('metal', 0.12, 0.075, 0.004, [tx, tyy, tz], [0, tilt, 0], 0xe2b92c, { uv: 2 });
    for (const sd of [0, 1]) { const o = sd ? -0.0032 : 0.0032; D.decal('decal', tagUV(i), 0.118, 0.073, [tx + Math.sin(tilt) * o, tyy, tz + Math.cos(tilt) * o], [0, tilt + (sd ? PI : 0), 0]); }
  });
  for (const [a, b] of [[0, 3], [3, 1], [1, 4], [2, 0], [0, 5]]) {   // transect strings between stakes (slightly sagging)
    const A = stakes[a], B = stakes[b], N = 4, ya = A[2] + A[3] - 0.1, yb = B[2] + B[3] - 0.1, pt = (t) => [lerp(A[0], B[0], t), lerp(ya, yb, t) - 0.07 * Math.sin(t * PI), lerp(A[1], B[1], t)];
    for (let i = 0; i < N; i++) Cl.between('metal', pt(i / N), pt((i + 1) / N), 0.0035, 3, 0xe8e3d2);
  }
  for (const [u, v, rot] of [[-1.6, 1.8, 0.2], [3.7, 0.2, -0.4]]) {   // quadrats: white PVC frames with string grids
    const [lx, lz] = toXZ(u, v), ty = topLocal(lx, lz) + 0.02, s = 0.25, c = Math.cos(rot), sn = Math.sin(rot), pt = (x, z) => [lx + x * c + z * sn, ty, lz - x * sn + z * c];
    for (const [a, b] of [[[-s, -s], [s, -s]], [[s, -s], [s, s]], [[s, s], [-s, s]], [[-s, s], [-s, -s]]]) Cl.between('metal', pt(...a), pt(...b), 0.011, 6, 0xe9ece8);
    for (let k = -1; k <= 1; k++) { const o = k * s / 2.4; Cl.between('metal', pt(-s, o), pt(s, o), 0.002, 3, 0xe8e3d2); Cl.between('metal', pt(o, -s), pt(o, s), 0.002, 3, 0xe8e3d2); }
  }

  // ───────────────────────── sign, sample cache, marker flag + beacon ─────────────────────────
  const SGX = 1.4, SGZ = 6.0, SGY = gy(SGX, SGZ);
  for (const sx of [-0.55, 0.55]) { Cl.cyl('metal', 0.04, 0.045, 1.3, 8, [SGX + sx, SGY + 0.65, SGZ], null, C.graphite); Cl.cyl('metal', 0.05, 0.05, 0.03, 8, [SGX + sx, SGY + 1.31, SGZ], null, C.steel); }
  Cl.box('metal', 1.34, 0.7, 0.045, [SGX, SGY + 0.88, SGZ - 0.02], null, 0x0e3844, { uv: 2 }); D.decal('decal', R.sign, 1.26, 0.63, [SGX, SGY + 0.88, SGZ + 0.0035], [0, 0, 0]); D.decal('decal', R.emb, 0.2, 0.2, [SGX + 0.5, SGY + 1.16, SGZ + 0.0035], [0, 0, 0]);
  col(kit.cyl(...F.xz(SGX - 0.55, SGZ), 0.1, y0 - 0.2, y0 + 1.35), kit.cyl(...F.xz(SGX + 0.55, SGZ), 0.1, y0 - 0.2, y0 + 1.35));
  {   // sample cache beside the sign: hard case + bucket
    const cx = SGX + 1.5, cz = SGZ + 0.1, cy = gy(cx, cz), bx = cx - 0.9, bz = cz + 0.5, by = gy(bx, bz);
    Pc.rbox('cache', 0.62, 0.28, 0.4, 0.03, { seg: 1, pos: [cx, cy + 0.14, cz], rot: [0, -0.25, 0], uv: 2 }, 0xd9731f); Pc.box('cache', 0.64, 0.02, 0.42, [cx, cy + 0.285, cz], [0, -0.25, 0], 0x303539, { uv: 2 });
    for (const sx of [-0.2, 0.2]) Pc.box('cache', 0.04, 0.05, 0.02, [cx + sx * Math.cos(0.25) - 0.2 * Math.sin(0.25), cy + 0.22, cz + 0.2 * Math.cos(0.25) - sx * Math.sin(0.25)], [0, -0.25, 0], 0xb0b6ba, { uv: 2 });
    Pc.cyl('cache', 0.15, 0.12, 0.3, 16, [bx, by + 0.15, bz], null, 0xe8ebe8); Pc.cyl('cache', 0.152, 0.152, 0.025, 16, [bx, by + 0.3, bz], null, C.teal); Cl.between('metal', [bx - 0.15, by + 0.29, bz], [bx + 0.15, by + 0.29, bz], 0.008, 4, 0x303539);
    col(kit.cyl(...F.xz(cx, cz), 0.42, y0 - 0.2, y0 + 0.4), kit.cyl(...F.xz(bx, bz), 0.2, y0 - 0.2, y0 + 0.4));
  }
  const FPx = 4.6, FPz = 4.2, FPy = gy(FPx, FPz), FH = 3.1;
  for (let i = 0; i < 6; i++) Cl.cyl('metal', 0.03, 0.03, FH / 6, 8, [FPx, FPy + FH / 12 + i * FH / 6, FPz], null, i % 2 ? C.white : C.orange);
  Cl.cyl('metal', 0.1, 0.12, 0.05, 12, [FPx, FPy + 0.025, FPz], null, C.graphite); for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 1.0; Cl.between('metal', [FPx + Math.cos(a) * 0.45, FPy + 0.03, FPz + Math.sin(a) * 0.45], [FPx, FPy + 0.95, FPz], 0.011, 4, C.steel); }
  Cl.cyl('metal', 0.045, 0.045, 0.1, 10, [FPx, FPy + FH + 0.05, FPz], null, C.graphite);
  col(kit.cyl(...F.xz(FPx, FPz), 0.14, y0 - 0.3, y0 + FH));
  const flagMat = S.once('m.markerFlag', () => kit.std({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, map: kit.canvasTexture(192, 120, (g, w, h) => {
    g.fillStyle = '#e8531c'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.14)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4f6f4'; g.fillRect(0, h * 0.82, w, h * 0.1); emblem(g, w * 0.5, h * 0.44, h * 0.34); kit.grime(g, w, h, { amount: 0.35, seed: 8, color: 'rgba(255,255,255,0.08)' });
  }, { wrap: false }) }));
  const flag = makeFlag(S, { w: 1.2, h: 0.78, mat: flagMat }), flagG = new THREE.Group(); flagG.position.set(FPx + 0.035, FPy + FH - 0.18, FPz); flagG.add(flag.mesh); root.add(flagG);
  updates.push((dt, t) => { flagG.rotation.y = S.wind.ang - slot.yaw + S.wind.jit * 0.6; flag.update(t); });
  const bcn = makeBeacon(S, [FPx, FPy + FH + 0.2, FPz], { color: 0x6fe6ff, lightI: 5, range: 16, period: 2.7, duty: 0.1, size: 0.07, phase: 0.62 }); root.add(bcn.group);
  updates.push((dt, t) => bcn.update(t));

  // ───────────────────────── assemble ─────────────────────────
  const atlas = shoreAtlas(S), decalMat = S.once('m.decalShore', () => kit.std({ map: atlas, transparent: true, depthWrite: false, roughness: 0.85, metalness: 0 }));
  const mk = (Pp, key, mat, o) => { const m = Pp.mesh(key, mat, o); if (m) root.add(m); return m; };
  mk(Rk, 'rock', S.mat.rock, { receive: true }); mk(Cl, 'metal', S.mat.metal, { post: (g) => weather(g, { strength: 0.3, height: 0.5, dust: [0.2, 0.2, 0.22] }) });
  mk(Pc, 'cache', S.mat.paint, { post: (g) => weather(g, { strength: 0.3, height: 0.4, dust: [0.2, 0.2, 0.22] }) });
  const dm = D.mesh('decal', decalMat, { cast: false, receive: true }); if (dm) { dm.renderOrder = 2; root.add(dm); }

  const [ix, iz] = toXZ(POOLS[0].u, POOLS[0].v - 2.6);
  interactables.push(kit.interactable({ id: 'poi.world.asphodel.poi.pools', lineId: 'world.asphodel.poi.pools', label: 'Inspect tide pools', pos: at(ix, 0.9, iz), radius: 3.4, object: shelfMesh }));
  return { group: root, interactables, colliders, update: (dt, t, cam) => { for (const u of updates) u(dt, t, cam); } };
}
