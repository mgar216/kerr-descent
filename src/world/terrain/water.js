// ORPHEUS · surface · sea water (Asphodel · Grey Shore).
//   createWater({ hf, atmo, biome, groundY0, seaRel, terrainShared }) → { group, update(camPos, t, sunDir), dispose(), mesh, material, uniforms }
//   camPos = camera in terrain-local space (x, z; y = height in the same frame as the terrain, i.e. without the landing offset of the world group).
//
// ONE mesh (one draw call) that follows the camera (xz): a polar grid — 128 sectors, geometric radial growth 0.9 m → 40 km — whose
// vertices sit at sea level minus planet curvature (vertex shader). The grid is FLAT; everything else is per-fragment:
//   · depth  = seaRel + η(p,t) − sfBakedH(p)   (baked terrain heights, shared textures; −1e4 outside the clipmap = open sea)
//     η is the analytic swell, so the visible waterline sweeps up and down the beach with the waves. The plane floats PLANE_H above the
//     nominal level (η is capped to that where the sand is wet) so every fragment with depth > 0 is in front of the terrain; fragments
//     with depth ≤ 0 are discarded → no hard intersection edge, the water simply fades to nothing where the sand rises out of it.
//     (update() lowers the plane when the camera is closer than PLANE_H to the sea, e.g. wading.)
//   · five directional sine waves (analytic gradient, shore-parallel swell first, slow phase warp + per-wave amplitude noise so crossing
//     trains never form a lattice) + two octaves of value-noise ripples; every component is faded by its pixel footprint and the faded
//     slope variance widens the sun glint (LEAN-style), so the far sea never aliases.
//   · premultiplied alpha:  out = body·(1−T)(1−F) + sky·F + glint (+ foam over it),  a = 1 − (1−F)·T,  T = exp(−1.3·pathLength)
//     → the black sand shows through the shallows exactly as much as the water column lets it.
//   · foam: streaky swash lace on the waterline (width never below ~2 px, so distant shores keep their white outline), breaker lines that
//     run shoreward at the shallow-water wave speed.
//   · aerial perspective in premultiplied form (identical to sfFog on the terrain), so the sea melts into the horizon seamlessly.
// Output is HDR linear radiance (no tone mapping / colour-space chunks). Uniform objects of `atmo` and `terrainShared` are shared by
// reference. Logarithmic depth buffer chunks included. Draws after the sky dome (renderOrder −10), before every other transparent.
import * as THREE from 'three';
import { GLSL_NOISE } from './noise.js';
import { GLSL_BAKED } from './terrain.js';
import { GLSL_ATMO } from './atmosphere.js';

const TAU = Math.PI * 2;
const SECTORS = 128, R_IN = 0.9, R_OUT = 40000, RATIO = 1.12;
const PLANE_H = 0.26;            // the flat mesh floats this far above the nominal sea level (≥ the wave height allowed at the waterline)
const G_EFF = 4.0;               // gravity used for the deep-water dispersion ω² = g·k (a little slow → calm, heavy sea)
// [angle off the "toward the shore" direction (deg), wavelength (m), amplitude (m), phase (rad)]
const WAVES = [
  [-7, 41, 0.22, 0.7],
  [16, 24, 0.14, 2.1],
  [-24, 9.6, 0.075, 4.0],
  [28, 5.4, 0.045, 5.3],
  [-44, 2.7, 0.022, 1.1],
];

// ───────────────────────────── geometry ─────────────────────────────
function buildGrid() {
  const S = SECTORS, n = Math.ceil(Math.log(R_OUT / R_IN) / Math.log(RATIO)) + 1;
  const g = Math.pow(R_OUT / R_IN, 1 / (n - 1));
  const nv = 1 + n * S;
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < n; i++) {
    const r = R_IN * Math.pow(g, i);
    for (let j = 0; j < S; j++) { const a = (j / S) * TAU, v = 1 + i * S + j; pos[v * 3] = Math.cos(a) * r; pos[v * 3 + 2] = Math.sin(a) * r; }
  }
  const idx = new Uint16Array((S + (n - 1) * S * 2) * 3);
  let k = 0;
  for (let j = 0; j < S; j++) { idx[k++] = 0; idx[k++] = 1 + ((j + 1) % S); idx[k++] = 1 + j; }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < S; j++) {
      const j1 = (j + 1) % S, i0 = 1 + i * S + j, i1 = 1 + i * S + j1, o0 = 1 + (i + 1) * S + j, o1 = 1 + (i + 1) * S + j1;
      idx[k++] = i0; idx[k++] = i1; idx[k++] = o0;
      idx[k++] = i1; idx[k++] = o1; idx[k++] = o0;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// ───────────────────────────── shaders ─────────────────────────────
const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec2 uCam; uniform float uGroundY; uniform float uSeaRel; uniform float uPlaneH; uniform float uK; uniform vec2 uCurvC;
varying vec2 vRel; varying vec3 vD;
void main(){
  vec2 p = uCam + position.xz;
  vec2 c = p - uCurvC;
  vec3 local = vec3(p.x, uGroundY + uSeaRel + uPlaneH - uK * dot(c, c), p.y);
  vec4 wp = modelMatrix * vec4(local, 1.0);
  vRel = position.xz;
  vD = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${GLSL_NOISE}
${GLSL_BAKED}
${GLSL_ATMO}
uniform float uT; uniform float uSeaRel; uniform float uEtaMax; uniform float uPlaneH; uniform float uK;
uniform vec2 uCam; uniform vec2 uRel; uniform vec2 uCurvC; uniform vec2 uToLand; uniform float uCoastD; uniform uint uSeed;
uniform vec3 uAmb; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec4 uCoef; uniform vec4 uCoef2; uniform vec4 uCoef3; uniform vec4 uFoam;
uniform vec4 uWv[5]; uniform vec2 uWp[5];
varying vec2 vRel; varying vec3 vD;

// directional sine waves: returns η, adds the slope gradient to g and the slope variance lost to footprint filtering to lost.
// A slowly varying phase warp (value + gradient from one 3D noise) makes the crests wander so crossing trains never form a regular lattice.
float sfWaves(vec2 p, vec2 pn, vec2 fx, vec2 fy, float amp, float warp, vec2 wg, out vec2 g, out float lost){
  float eta = 0.0; g = vec2(0.0); lost = 0.0;
  const float WS[5] = float[5](1.0, -0.8, 0.9, -1.1, 0.7);
  for (int i = 0; i < 5; i++){
    vec4 w = uWv[i];
    float k = w.z;
    float fpi = max(abs(dot(fx, w.xy)), abs(dot(fy, w.xy)));          // pixel footprint along the wave direction
    float fade = 1.0 - smoothstep(0.07, 0.22, fpi * k * 0.15915494);  // footprint / wavelength
    if (fade <= 0.0) { float a0 = w.w * amp * 0.825; lost += 0.5 * a0 * a0 * k * k; continue; }   // unresolved: all of it becomes glint roughness
    float fi = float(i);
    float nm = sfVN2(pn * (0.017 + 0.0045 * fi) + vec2(7.3, 3.1) * fi + vec2(uT * 0.006, -uT * 0.004) * (1.0 + fi), uSeed + 120u + uint(i));
    float a = w.w * amp * (0.45 + 0.75 * nm);
    float ph = k * dot(w.xy, p) + uWp[i].y + warp * WS[i];
    float s = sin(ph), c = cos(ph);
    eta += a * fade * s;
    g += (w.xy * k + wg * WS[i]) * (a * fade * c);
    lost += (1.0 - fade) * 0.5 * a * a * k * k;
  }
  return eta;
}

// two octaves of value-noise ripples (slope gradient); RMS slope per axis ≈ sig
vec2 sfRipple(vec2 p, float t, float pf, out float lost){
  const float f1 = 0.85, f2 = 2.7, sig1 = 0.065, sig2 = 0.040;
  float fd1 = 1.0 - smoothstep(0.10, 0.34, pf * f1), fd2 = 1.0 - smoothstep(0.10, 0.34, pf * f2);
  vec2 g = vec2(0.0);
  if (fd1 > 0.0) {
    vec2 q1 = vec2(0.8 * p.x - 0.6 * p.y, 0.6 * p.x + 0.8 * p.y) * f1 + vec2(0.37, 0.21) * t;
    vec4 n1 = sfVN3(vec3(q1, t * 0.23), uSeed + 91u);
    g += vec2(0.8 * n1.y + 0.6 * n1.z, -0.6 * n1.y + 0.8 * n1.z) * (fd1 * sig1 / 0.49);
  }
  if (fd2 > 0.0) {
    vec2 q2 = vec2(0.6 * p.x + 0.8 * p.y, -0.8 * p.x + 0.6 * p.y) * f2 + vec2(-0.55, 0.43) * t;
    vec4 n2 = sfVN3(vec3(q2, t * 0.41 + 5.0), uSeed + 92u);
    g += vec2(0.6 * n2.y - 0.8 * n2.z, 0.8 * n2.y + 0.6 * n2.z) * (fd2 * sig2 / 0.49);
  }
  lost = 2.0 * ((1.0 - fd1) * sig1 * sig1 + (1.0 - fd2) * sig2 * sig2);
  return g;
}

// foam coverage: lace texture value tex (mean 0.5, contrast-stretched here), breaker profile prof, soft-threshold half-width wd (grows when unresolved)
// uFoam = (swash depth range m, swash coverage gain, threshold, breaker threshold)
float sfFoamCov(float tex, float depth, float depth0, float crest, float prof, float grp, float wd, float dd0){
  float tx = clamp(0.5 + (tex - 0.5) * 2.0, 0.0, 1.0);
  float edge = 1.0 - smoothstep(0.0, max(uFoam.x, 2.5 * dd0), depth);           // ≥ 2.5 px wide in the distance
  float rim = (1.0 - smoothstep(0.0, max(0.03, 1.5 * dd0), depth)) * (0.45 + 0.55 * tx);
  float edge2 = 1.0 - smoothstep(0.0, max(0.35, 2.5 * dd0), depth);              // sparse flecks out to ≈0.35 m
  float swash = max(smoothstep(-wd, wd, tx + uFoam.y * pow(edge, 1.2) - uFoam.z) * smoothstep(0.0, 0.1, edge),
                    smoothstep(-wd, wd, tx + 0.30 * edge2 - 0.98) * smoothstep(0.0, 0.1, edge2) * 0.8);
  float bEnv = smoothstep(0.30, 0.52, depth0) * (1.0 - smoothstep(0.80, 1.5, depth0));
  float brk = smoothstep(-wd, wd, tx + 0.55 * prof - uFoam.w) * bEnv * (0.5 + 0.5 * crest) * grp;
  return clamp(max(swash * uCoef2.z, rim * 0.8) + brk * uCoef2.w, 0.0, 1.0);
}

void main(){
  #include <logdepthbuf_fragment>
  vec2 pa = uCam + vRel;                       // absolute terrain-local xz (noise lattices, baked heights)
  vec2 pr = uRel + vRel;                       // xz relative to the wave origin (small numbers → exact sin phases)
  vec2 fx = dFdx(pr), fy = dFdy(pr);
  float pf = max(length(fx), length(fy));      // pixel footprint (m)

  float H = sfBakedH(pa);
  float depth0 = uSeaRel - H;
  float dd0 = min(fwidth(depth0), 2.0);        // depth change per pixel (derivative taken before any discard)
  if (depth0 < -uEtaMax) discard;
  if (H < -9000.0 && uCoastD - dot(pa, -uToLand) > 0.0) discard;             // outside the clipmap: open sea only seaward of the (unwobbled) coast line

  float pat = sfVN2(pa * 0.0085 + vec2(uT * 0.011, -uT * 0.007), uSeed + 211u);
  float amp = (0.55 + 0.45 * pat) * (0.45 + 0.55 * smoothstep(0.0, 1.2, depth0)) * uCoef2.y;
  vec4 wn = sfVN3(vec3(pa * 0.045, uT * 0.03), uSeed + 77u);
  vec2 gw; float lostW;
  float eta = sfWaves(pr, pa, fx, fy, amp, (wn.x - 0.5) * 2.6, wn.yz * (0.045 * 2.6), gw, lostW);
  eta = min(eta, uPlaneH + 0.5 * max(depth0, 0.0));                       // the plane must stay above any wet terrain
  float depth = depth0 + eta;
  if (depth <= 0.0) discard;

  float lostR;
  vec2 gr = sfRipple(pa, uT, pf, lostR) * uCoef.w;
  lostR *= uCoef.w * uCoef.w;

  float dist = length(vD);
  vec3 V = -vD / dist;
  vec3 Nc = normalize(vec3(2.0 * uK * (pa.x - uCurvC.x), 1.0, 2.0 * uK * (pa.y - uCurvC.y)));
  vec2 gs = gw + gr;
  vec3 N = normalize(vec3(Nc.x - gs.x, Nc.y, Nc.z - gs.y));
  float nv = clamp(dot(N, V), 0.0, 1.0);
  float nvm = max(nv, 0.015);
  float Gm = 2.0 / (1.0 + sqrt(1.0 + uCoef3.x * (1.0 - nvm * nvm) / (nvm * nvm)));      // Smith masking: a rough sea reflects less at grazing angles
  float F = (0.02 + 0.98 * pow(1.0 - nv, 5.0)) * mix(1.0, Gm, uCoef3.y * (1.0 - smoothstep(600.0, 3500.0, dist)));    // far sea: full grazing reflection → melts into the hazy horizon
  float cosT = sqrt(max(1.0 - (1.0 - nv * nv) * 0.5653, 0.0));
  float path = depth / max(cosT, 0.35);
  float Tt = exp(-uCoef.y * path);

  // ── light ──
  vec3 L = uAtSun;
  float sunN = max(dot(Nc, L), 0.0);
  float Fs = 0.02 + 0.98 * pow(1.0 - clamp(sunN, 0.0, 1.0), 5.0);
  vec3 irr = uAtSunCol * (sunN * (1.0 - Fs) * 0.31831) + uAmb;
  vec3 bodyAlb = mix(uShallow, uDeep, 1.0 - exp(-depth * uCoef.x));
  float crest = clamp(eta / uEtaMax * 0.5 + 0.5, 0.0, 1.0);
  vec3 body = bodyAlb * irr * (0.82 + 0.36 * crest);
  float sss = pow(clamp(dot(-V, L) * 0.5 + 0.5, 0.0, 1.0), 4.0) * smoothstep(0.35, 1.0, crest);
  body += uShallow * uAtSunCol * (sss * uCoef2.x * (1.0 - Fs));

  // ── reflection + sun glint ──
  vec3 R = reflect(-V, N);
  R -= Nc * (2.0 * min(dot(R, Nc), 0.0));
  vec3 sky = sfSkyRefl(R);
  float rl = max(dot(R, L), 0.0);
  float nGl = 1.0 / (1.0 / uCoef3.z + 2.0 * (lostW + lostR));
  float glint = pow(rl, nGl) * (nGl / uCoef3.z);
  vec3 refl = (sky + uAtSunCol * (glint * uCoef.z)) * F;

  vec3 src = body * ((1.0 - Tt) * (1.0 - F)) + refl;
  float a = 1.0 - (1.0 - F) * Tt;

  // ── foam: swash lace (streaks elongated across the shore) on the waterline + breaker lines running onto the beach ──
  float foam = 0.0, tex = 0.5;
  if (depth0 < 1.7) {
    vec2 qa = vec2(dot(pa, vec2(-uToLand.y, uToLand.x)), dot(pa, uToLand) - uT * 0.5);       // (along shore, toward land), drifting shoreward
    float fA = 1.0 - smoothstep(0.12, 0.5, pf * 1.1), fB = 1.0 - smoothstep(0.12, 0.5, pf * 3.4), fC = 1.0 - smoothstep(0.12, 0.5, pf * 9.0), fD = 1.0 - smoothstep(0.12, 0.5, pf * 22.0);
    float nA = mix(0.5, sfVN2(qa * vec2(1.1, 0.55) + 3.0, uSeed + 301u), fA);
    float rB = mix(0.5, 1.0 - abs(2.0 * sfVN2(qa * vec2(3.4, 1.3) + vec2(0.0, uT * 0.45), uSeed + 302u) - 1.0), fB);       // ridged octaves → thin lace threads
    float rC = mix(0.5, 1.0 - abs(2.0 * sfVN2(qa * vec2(9.0, 3.6) + vec2(5.0, -uT * 0.25), uSeed + 304u) - 1.0), fC);
    float nD = mix(0.5, sfVN2(qa * vec2(22.0, 11.0) + vec2(0.0, uT * 0.70), uSeed + 305u), fD);
    tex = nA * 0.20 + rB * 0.30 + rC * 0.28 + nD * 0.22;
    float bph = depth0 * 2.1 + uT * 0.31 + (sfVN2(pa * 0.04, uSeed + 303u) - 0.5) * 2.4;
    float saw = fract(bph);
    float bpx = 2.1 * dd0;                                             // breaker phase change per pixel
    float prof = smoothstep(0.0, max(0.03, 1.2 * bpx), saw) * (1.0 - smoothstep(0.0, 0.42, saw));
    float grp = 0.65 + 0.35 * sin(uT * 0.23 + dot(pa, vec2(0.021, 0.009)));
    float fb = smoothstep(0.25, 0.8, bpx);                             // unresolved breaker bands → mean profile
    float wd = mix(0.13, 0.45, 1.0 - fA * 0.5 - fB * 0.5);
    foam = sfFoamCov(tex, depth, depth0, crest, mix(prof, 0.26, fb), grp, wd, dd0);
  }
  vec3 foamLit = vec3(0.80, 0.84, 0.84) * (0.78 + 0.40 * tex) * (uAtSunCol * (sunN * 0.31831) + uAmb);
  float fa = foam * 0.92;
  src = mix(src, foamLit * (0.65 + 0.35 * foam), fa);
  a = mix(a, 1.0, fa);

  // ── aerial perspective (premultiplied) ──
  vec3 T = mix(vec3(1.0), exp(-uAtFogExt * dist), uAtOn);
  vec3 insc = sfSky(normalize(vec3(-V.x, max(-V.y, 0.0), -V.z) + vec3(1e-6, 0.0, 1e-6)));
  src = src * T + insc * ((1.0 - T) * a);
  gl_FragColor = vec4(src, a);
}`;

// ───────────────────────────── module ─────────────────────────────
export function createWater(o) {
  const { hf, atmo, groundY0, seaRel, terrainShared: ts } = o;
  const wind = hf?.site?.wind ?? 0.6, windK = Math.min(1.6, Math.max(0.6, 0.4 + wind));       // tuned at wind 0.6 (Grey Shore) → 1.0
  const P = hf?.P;
  let nx = P ? P[4] : -1, nz = P ? P[5] : 0;
  const nl = Math.hypot(nx, nz);
  if (nl < 1e-3) { nx = -1; nz = 0; } else { nx /= nl; nz /= nl; }
  const tx = -nx, tz = -nz;                         // direction of travel: toward the land

  // waves
  const wv = [], wp = [], base = new Float64Array(WAVES.length), om = new Float64Array(WAVES.length), wd = [];
  let etaMax = 0;
  WAVES.forEach(([deg, lam, amp, ph0], i) => {
    const th = deg * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    const dx = tx * c - tz * s, dz = tx * s + tz * c, k = TAU / lam;
    wv.push(new THREE.Vector4(dx, dz, k, amp)); wp.push(new THREE.Vector2(0, ph0));
    wd.push([dx, dz, k, ph0]); om[i] = Math.sqrt(G_EFF * k); etaMax += amp;
  });
  etaMax += 0.01;

  const U = {
    ...atmo.uniforms,
    uHT: ts.uHT, uHC: ts.uHC, uK: ts.uK, uCurvC: ts.uCurvC, uGroundY: ts.uGroundY, uSeed: ts.uSeed,
    uCam: { value: new THREE.Vector2() }, uRel: { value: new THREE.Vector2() }, uT: { value: 0 }, uToLand: { value: new THREE.Vector2(tx, tz) }, uCoastD: { value: P ? P[6] : 0 },
    uSeaRel: { value: seaRel }, uEtaMax: { value: etaMax }, uPlaneH: { value: PLANE_H },
    uAmb: { value: new THREE.Vector3(0.08, 0.10, 0.12) },
    uShallow: { value: new THREE.Vector3(0.05, 0.55, 0.55) }, uDeep: { value: new THREE.Vector3(0.01, 0.10, 0.22) },
    uCoef: { value: new THREE.Vector4(0.30, 1.3, 4.0, windK) },   // deepK, alphaK, glint gain, ripple gain
    uCoef2: { value: new THREE.Vector4(0.08, 0.7 + 0.3 * windK, 1.0, 1.0) },   // sss gain, swell gain, swash foam gain, breaker foam gain
    uCoef3: { value: new THREE.Vector4(0.02, 0.9, 700, 0) },      // masking roughness², masking amount, glint exponent
    uFoam: { value: new THREE.Vector4(0.12, 0.42, 0.97, 0.92) },  // swash depth range, swash gain, swash threshold, breaker threshold
    uWv: { value: wv }, uWp: { value: wp },
  };
  const geo = buildGrid();
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: U,
    transparent: true, depthWrite: false, depthTest: true, premultipliedAlpha: true, side: THREE.FrontSide, fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10; mesh.name = 'sea'; mesh.castShadow = false; mesh.receiveShadow = false;
  const group = new THREE.Group(); group.name = 'water'; group.add(mesh);

  // wave-phase origin (rebased in double precision so the GPU only ever sees small phase arguments)
  let ox = NaN, oz = NaN;
  function rebase(x, z) {
    ox = Math.round(x); oz = Math.round(z);
    for (let i = 0; i < wd.length; i++) base[i] = (wd[i][2] * (wd[i][0] * ox + wd[i][1] * oz) + wd[i][3]) % TAU;
  }

  return {
    group, mesh, material: mat, uniforms: U,
    update(camPos, t, sunDir) {
      const x = camPos.x, z = camPos.z;
      if (!(Math.abs(x - ox) < 300 && Math.abs(z - oz) < 300)) rebase(x, z);
      // the flat plane floats PLANE_H above the nominal sea level; lower it when the camera is closer than that (wading)
      const cc = ts.uCurvC.value, dx = x - cc.x, dz = z - cc.y, camH = camPos.y - ((ts.uGroundY ? ts.uGroundY.value : groundY0) + seaRel - ts.uK.value * (dx * dx + dz * dz));
      U.uPlaneH.value = Number.isFinite(camH) ? Math.min(PLANE_H, Math.max(0, camH - 0.05)) : PLANE_H;
      U.uCam.value.set(x, z);
      U.uRel.value.set(x - ox, z - oz);
      U.uT.value = t;
      for (let i = 0; i < wp.length; i++) wp[i].y = (base[i] - om[i] * t) % TAU;
      const h = atmo.hemiSky; U.uAmb.value.set(h.r, h.g, h.b);
    },
    dispose() { geo.dispose(); mat.dispose(); group.remove(mesh); },
  };
}
