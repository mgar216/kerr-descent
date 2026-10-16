// ORPHEUS · surface · FX.
//   createSurfaceFx(env) → { group, update(dt, t, camPos), burst(kind, x, z, strength), geyserLevel(camPos) → 0..1, dispose(), info }
// Touchdown / lift-off ground bursts (all biomes; charon = pure ballistic regolith), camera-follow ambient particles per biome and
// cocytus geysers. Everything is GPU-driven: instanced billboard quads / Points with closed-form, time-driven vertex shaders (no CPU
// particle loops, no per-frame allocation). Soft puffs share one procedural height-field puff texture (density + normal + detail) and
// are wrap-lit from the scene's real sun/hemisphere lights (picked up by name: 'surface-sun' / 'surface-hemi').
// Frame: SHIP SPACE (absolute positions; the group is never offset). Logarithmic depth buffer compatible.
import * as THREE from 'three';
import { BODY_FALLBACK, LOOKS } from './sites.js';
import { mulberry, rand01 } from './noise.js';
import { GLSL_ATMO } from './atmosphere.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// per-biome wind: unit direction (x, z) and speed (m/s) at site.wind = 1
const WIND = {
  asphodel: { d: [0.82, 0.57], v: 5.0 }, phlegethon: { d: [-0.5, 0.866], v: 4.0 }, charon: { d: [1, 0], v: 0 },
  cocytus: { d: [0.96, 0.28], v: 14.0 }, elysium: { d: [0.3, -0.954], v: 1.6 },
};

// ───────────────────────────── puff texture ─────────────────────────────
// RGBA8 data texture: R = density, G/B = sprite-space normal xy (0.5 + 0.5 n), A = tileable detail noise.
function makePuffTexture() {
  const S = 160, N = S * S;
  const rnd = mulberry(0x51ab9e37);
  const lat = [4, 8, 16, 32, 64].map((n) => { const g = new Float32Array(n * n * 2); for (let i = 0; i < n * n; i++) { const a = rnd() * TAU; g[i * 2] = Math.cos(a); g[i * 2 + 1] = Math.sin(a); } return g; });
  const pn = (u, v, o) => {                                // periodic gradient (Perlin) noise, ≈ [0,1]
    const n = 4 << o, G = lat[o], x = u * n, y = v * n;
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const x0 = ((ix % n) + n) % n, x1 = (x0 + 1) % n, y0 = ((iy % n) + n) % n, y1 = (y0 + 1) % n;
    const i00 = (y0 * n + x0) * 2, i10 = (y0 * n + x1) * 2, i01 = (y1 * n + x0) * 2, i11 = (y1 * n + x1) * 2;
    const a = G[i00] * fx + G[i00 + 1] * fy, b = G[i10] * (fx - 1) + G[i10 + 1] * fy, c = G[i01] * fx + G[i01 + 1] * (fy - 1), d = G[i11] * (fx - 1) + G[i11 + 1] * (fy - 1);
    const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10), sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const r = (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 0.8 + 0.5; return r < 0 ? 0 : r > 1 ? 1 : r;
  };
  const fbm = (u, v, oct) => { let s = 0, a = 0.5, t = 0; for (let o = 0; o < oct; o++) { s += a * pn(u, v, o); t += a; a *= 0.55; } return s / t; };
  const lobes = [{ x: 0, y: 0.0, r: 0.52, w: 1.0 }];
  for (let i = 0; i < 12; i++) { const a = rnd() * TAU, d = 0.10 + 0.42 * Math.sqrt(rnd()); lobes.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 0.16 + 0.18 * rnd(), w: 0.4 + 0.5 * rnd() }); }
  const Hh = new Float32Array(N), Dd = new Float32Array(N);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S, v = (y + 0.5) / S, px = u * 2 - 1, py = v * 2 - 1;
    const qx = px + (fbm(u, v, 3) - 0.5) * 0.30, qy = py + (fbm(u + 0.37, v + 0.61, 3) - 0.5) * 0.30;
    let hump = 0;
    for (let k = 0; k < lobes.length; k++) { const l = lobes[k], dx = qx - l.x, dy = qy - l.y, d2 = (dx * dx + dy * dy) / (l.r * l.r); if (d2 < 2.4) hump += l.w * Math.exp(-2.2 * d2); }
    let h = hump * (0.40 + 1.15 * fbm(u + 0.13, v + 0.71, 5));
    h *= 1 - smooth(0.62, 0.98, Math.hypot(px, py));
    Hh[y * S + x] = h; Dd[y * S + x] = fbm(u, v, 5);
  }
  // blurred copy for smooth, bubble-free shading normals
  const tmp = new Float32Array(N), Bh = new Float32Array(N), R = 5;
  const blur = (src, dst, horiz) => {
    for (let a = 0; a < S; a++) {
      let sum = 0; const idx = (b) => (horiz ? a * S + b : b * S + a);
      for (let b = -R; b <= R; b++) sum += src[idx(Math.min(Math.max(b, 0), S - 1))];
      for (let b = 0; b < S; b++) { dst[idx(b)] = sum / (2 * R + 1); sum += src[idx(Math.min(b + R + 1, S - 1))] - src[idx(Math.max(b - R, 0))]; }
    }
  };
  blur(Hh, tmp, true); blur(tmp, Bh, false); blur(Bh, tmp, true); blur(tmp, Bh, false);
  const data = new Uint8Array(N * 4), kS = S * 0.16;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const xm = Bh[y * S + Math.max(x - 1, 0)], xp = Bh[y * S + Math.min(x + 1, S - 1)], ym = Bh[Math.max(y - 1, 0) * S + x], yp = Bh[Math.min(y + 1, S - 1) * S + x];
    let nx = -(xp - xm) * 0.5 * kS, ny = -(yp - ym) * 0.5 * kS; const l = Math.hypot(nx, ny, 1); nx /= l; ny /= l;
    data[i * 4] = ((1 - Math.exp(-2.4 * Hh[i])) * 255) | 0; data[i * 4 + 1] = ((nx * 0.5 + 0.5) * 255) | 0; data[i * 4 + 2] = ((ny * 0.5 + 0.5) * 255) | 0; data[i * 4 + 3] = (Dd[i] * 255) | 0;
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  return tex;
}

// ───────────────────────────── shared GLSL ─────────────────────────────
// instanced-quad particles (puffs, sparks, velocity streaks) share one vertex prelude and one fragment shader
const QUAD_VS = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
${GLSL_ATMO}
attribute vec4 aA; attribute vec4 aB;
uniform float uTime; uniform float uViewH; uniform vec3 uCam; uniform vec3 uSunDir; uniform vec3 uSkyIrr; uniform vec3 uGndIrr; uniform int uAmbN;
varying vec2 vUv; varying vec2 vRot; varying vec4 vAlb; varying vec4 vPar; varying vec3 vEm;
varying vec3 vVP; varying vec3 vL; varying vec3 vUp;
varying vec3 vAmbU; varying vec3 vAmbH; varying vec3 vAmbG; varying vec3 vFogT; varying vec3 vFogI;
void qHide(){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vUv = vec2(0.5); vRot = vec2(1.0, 0.0); vAlb = vec4(0.0); vPar = vec4(0.0); vEm = vec3(0.0); vVP = vec3(0.0, 0.0, -1.0); vL = vec3(0.0, 1.0, 0.0); vUp = vec3(0.0, 1.0, 0.0); vAmbU = vAmbH = vAmbG = vFogI = vec3(0.0); vFogT = vec3(1.0); }
// per-vertex lighting environment: view/sun vectors, ambient radiance (zenith / horizon ring / ground) from the real sky, aerial-perspective fog
void qCommon(vec4 mv){
  vVP = mv.xyz; vL = normalize(mat3(viewMatrix) * uSunDir); vUp = viewMatrix[1].xyz;
  if (uAtOn > 0.5) {
    vec3 sh = normalize(vec3(uAtSun.x, 0.0, uAtSun.z) + vec3(1e-4, 0.0, 1e-4));
    vec3 sp = vec3(-sh.z, 0.0, sh.x), lift = vec3(0.0, 0.2, 0.0);
    vec3 vd = normalize((vec4(mv.xyz, 0.0) * viewMatrix).xyz);
    vec3 aU = vec3(0.0), aH = vec3(0.0), aF = vec3(0.0);
    for (int i = 0; i < uAmbN; i++) {                   // uniform bound (=6): keeps ONE sfSky body in the program instead of six inlined copies
      vec3 dir = i == 0 ? vec3(0.0, 1.0, 0.0) : i == 1 ? sh * 0.98 + lift : i == 2 ? sp * 0.98 + lift : i == 3 ? -sp * 0.98 + lift : i == 4 ? -sh * 0.98 + lift : vec3(vd.x, max(vd.y, 0.0), vd.z);
      vec3 s = sfSky(normalize(dir));
      if (i == 0) aU = s; else if (i == 1) aH += 0.12 * s; else if (i == 4) aH += 0.30 * s; else if (i < 4) aH += 0.29 * s; else aF = s;
    }
    vAmbU = aU; vAmbH = aH;
    vAmbG = uAtGround * (uAtSunCol * (max(uAtSun.y, 0.0) * 0.12) + aH * 0.30 + vec3(0.01));       // = sfSkyRefl(down)
    vFogT = exp(-uAtFogExt * length(mv.xyz)); vFogI = aF;
  } else { vAmbU = uSkyIrr; vAmbH = mix(uGndIrr, uSkyIrr, 0.5); vAmbG = uGndIrr; vFogT = vec3(1.0); vFogI = vec3(0.0); }
}
vec4 gMV = vec4(0.0, 0.0, -1.0, 1.0);                // view-space position written by the emit helpers; qFinish() lights + projects it once per shader
void qFinish(){ qCommon(gMV); gl_Position = projectionMatrix * gMV; }
// soft lit puff: centre wp, radius sz, spin, albedo, opacity, dissolve threshold, additive emission, forward-scatter gain
float gStretch = 1.0;                                 // >1: puff elongated along its local x axis (spin picks the screen direction)
void qPuff(vec3 wp, float sz, float spin, vec3 alb, float alpha, float thr, vec3 em, float fwd, float seed){
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float nf = smoothstep(0.35, 3.0, max(-mv.z, 0.001));
  float cs = cos(spin), sn = sin(spin);
  vec2 q = position.xy, qs = vec2(q.x * gStretch, q.y);
  mv.xy += vec2(cs * qs.x - sn * qs.y, sn * qs.x + cs * qs.y) * sz;
  vUv = q * 0.5 + 0.5; vRot = vec2(cs, sn);
  vAlb = vec4(alb, alpha * nf); vPar = vec4(thr, 0.0, fwd, seed); vEm = em * nf;
  gMV = mv;
}
// additive glowing dot (sparks, embers, glints); never smaller than ~1 px, energy conserved below that
void qDot(vec3 wp, float sz, vec3 em, float alpha, float glint, float seed){
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float depth = max(-mv.z, 0.001);
  float pxm = projectionMatrix[1][1] * uViewH * 0.5 / depth;
  sz *= clamp(depth / 14.0, 0.18, 1.0);                    // glints/embers never balloon into bokeh discs next to the lens
  float cov = clamp(sz * pxm / 1.1, 0.0, 1.0);
  sz = max(sz, 1.1 / pxm);
  vec2 q = position.xy;
  mv.xy += q * sz;
  vUv = q * 0.5 + 0.5; vRot = vec2(1.0, 0.0);
  vAlb = vec4(0.0, 0.0, 0.0, alpha * cov * cov * smoothstep(0.2, 1.5, depth)); vPar = vec4(0.0, 1.0, glint, seed); vEm = em;
  gMV = mv;
}
// velocity streak between tail and head (world space ribbon facing the camera)
void qStreak(vec3 ph, vec3 pt, float w, vec3 alb, float alpha){
  vec4 mvh = modelViewMatrix * vec4(ph, 1.0);
  float depth = max(-mvh.z, 0.001);
  w *= clamp(depth / 14.0, 0.18, 1.0);                    // no fat rods right next to the lens
  vec3 d = ph - pt; float L = length(d);
  vec3 ax = L > 1e-4 ? d / L : vec3(0.0, 1.0, 0.0);
  if (L < 2.5 * w) pt = ph - ax * (2.5 * w);               // never shorter than a capsule
  vec3 sd = cross(ax, normalize(uCam - ph + vec3(0.0, 1e-3, 0.0))); float sl = length(sd);
  sd = sl > 1e-4 ? sd / sl : vec3(1.0, 0.0, 0.0);
  bool head = position.y > 0.0;
  float pxm = projectionMatrix[1][1] * uViewH * 0.5 / depth;
  float cov = clamp(w * pxm / 0.9, 0.0, 1.0);
  w = max(w, 0.9 / pxm);
  vec4 mv = modelViewMatrix * vec4((head ? ph : pt) + sd * (position.x * w), 1.0);
  vUv = vec2(position.x * 0.5 + 0.5, head ? 1.0 : 0.0); vRot = vec2(1.0, 0.0);
  vAlb = vec4(alb, alpha * cov * smoothstep(0.2, 1.5, depth)); vPar = vec4(0.0, 2.0, 0.0, 0.0); vEm = vec3(0.0);
  gMV = mv;
}
`;

const QUAD_FS = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uTex; uniform vec3 uSunIrr; uniform float uDesat; uniform float uAmbGain;
varying vec2 vUv; varying vec2 vRot; varying vec4 vAlb; varying vec4 vPar; varying vec3 vEm;
varying vec3 vVP; varying vec3 vL; varying vec3 vUp;
varying vec3 vAmbU; varying vec3 vAmbH; varying vec3 vAmbG; varying vec3 vFogT; varying vec3 vFogI;
void main(){
  #include <logdepthbuf_fragment>
  float kind = vPar.y;
  vec3 V = normalize(-vVP);
  if (kind < 0.5) {
    vec4 t = texture2D(uTex, vUv);
    float da = vPar.w * 18.8496, ds = 1.25 + 0.9 * fract(vPar.w * 7.77);
    vec2 dq = (vUv - 0.5) * ds;
    float det = texture2D(uTex, vec2(cos(da) * dq.x - sin(da) * dq.y, sin(da) * dq.x + cos(da) * dq.y) + vec2(0.31, 0.77) * (vPar.w * 11.0)).a;   // RepeatWrapping: no fract() → no mip seams
    float dens = t.r * (0.62 + 0.76 * det);
    float cut = smoothstep(vPar.x, vPar.x + 0.7, dens);
    cut *= cut * (3.0 - 2.0 * cut);
    float al = vAlb.a * cut;
    if (al + max(vEm.r, max(vEm.g, vEm.b)) * cut < 0.004) discard;
    vec2 nx = (t.gb * 2.0 - 1.0) * 0.6;
    nx = vec2(vRot.x * nx.x - vRot.y * nx.y, vRot.y * nx.x + vRot.x * nx.y);
    vec3 n = vec3(nx, sqrt(max(1.0 - dot(nx, nx), 0.0)));
    float wr = clamp((dot(n, vL) + 0.55) / 1.55, 0.0, 1.0);
    float cosT = dot(-V, vL);
    float hg = 0.4816 / pow(1.5184 - 1.44 * cosT, 1.5);   // Henyey-Greenstein g = 0.72 (≈ 0.09 … 22): silver lining when looking toward the sun
    vec3 sunC = uSunIrr;
    float ny = dot(n, vUp);
    vec3 amb = ny > 0.0 ? mix(vAmbH, vAmbU, ny) : mix(vAmbH, vAmbG, -ny);
    vec3 irr = sunC * (0.20 + 0.80 * wr * wr) + amb * uAmbGain;
    irr += sunC * (vPar.z * 0.10 * hg * (1.0 - 0.35 * dens));
    irr = mix(irr, vec3(dot(irr, vec3(0.2126, 0.7152, 0.0722))), uDesat);
    irr *= mix(1.12, 0.82, dens);
    vec3 col = vAlb.rgb * irr;
    col = col * vFogT + vFogI * (1.0 - vFogT);
    gl_FragColor = vec4(col * al + vEm * (vFogT * cut), al);
  } else if (kind < 1.5) {
    vec2 q = vUv * 2.0 - 1.0; float r2 = dot(q, q);
    float core = exp(-r2 * 5.0);
    float star = max(exp(-abs(q.x) * 22.0 - abs(q.y) * 2.6), exp(-abs(q.y) * 22.0 - abs(q.x) * 2.6));
    float s = max(core * (1.0 - 0.8 * vPar.z), star * vPar.z) * (1.0 - smoothstep(0.78, 1.0, sqrt(r2)));
    if (s * vAlb.a < 0.002) discard;
    gl_FragColor = vec4(vEm * vFogT * (s * vAlb.a), 0.0);
  } else {
    float across = abs(vUv.x * 2.0 - 1.0);
    float a = vAlb.a * (1.0 - across * across) * smoothstep(0.0, 0.35, vUv.y) * (1.0 - 0.85 * smoothstep(0.72, 1.0, vUv.y));
    if (a < 0.002) discard;
    float ph = 0.5 + 0.5 * dot(vL, V);
    vec3 col = vAlb.rgb * (uSunIrr * (0.35 + 1.2 * ph) + vAmbH);
    col = col * vFogT + vFogI * (1.0 - vFogT);
    gl_FragColor = vec4(col * a, a);
  }
}`;

// Points (tiny motes): one vertex per particle
const POINT_VS = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec4 aB;
uniform float uTime; uniform float uViewH; uniform vec3 uCam; uniform vec3 uSunDir; uniform vec3 uSunIrr; uniform vec3 uSkyIrr; uniform vec3 uGndIrr;
varying vec4 vC; varying vec2 vS;
void pHide(){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; vC = vec4(0.0); vS = vec2(0.0); }
void pEmit(vec3 wp, float size, vec3 col, float alpha, float shape, float glint){
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float depth = max(-mv.z, 0.02);
  float px = size * projectionMatrix[1][1] * uViewH / depth;         // diameter in px
  float cov = clamp(px, 0.0, 1.0);
  gl_PointSize = clamp(px, 1.0, 64.0);
  gl_Position = projectionMatrix * mv;
  vC = vec4(col, alpha * cov * cov * smoothstep(0.05, 0.6, depth)); vS = vec2(shape, glint);
}
`;
const POINT_FS = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec4 vC; varying vec2 vS;
void main(){
  #include <logdepthbuf_fragment>
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 4.5);
  float star = max(exp(-abs(q.x) * 16.0 - abs(q.y) * 2.2), exp(-abs(q.y) * 16.0 - abs(q.x) * 2.2));
  float s = mix(core, max(core * (1.0 - 0.8 * vS.y), star * vS.y), vS.x) * (1.0 - smoothstep(0.7, 1.0, sqrt(r2)));
  #ifdef ADDITIVE
  gl_FragColor = vec4(vC.rgb * (s * vC.a), 0.0);
  #else
  gl_FragColor = vec4(vC.rgb * (s * vC.a), vC.a * s);
  #endif
}`;

// ───────────────────────────── burst shaders ─────────────────────────────
const BURST_UNI = /* glsl */ `
uniform vec4 uBurst;      // t0, strength, kind (0 touchdown / 1 lift-off), -
uniform vec3 uOrg;        // origin (x, groundY, z)
uniform float uGrav;      // m/s²
uniform vec2 uWind;       // m/s (xz)
uniform vec3 uAlbA; uniform vec3 uAlbB; uniform vec3 uAlbG;
uniform vec3 uEmA; uniform vec3 uEmB; uniform vec4 uTune;   // x: opacity gain, y: spark gain, z: roll gain, w: heat emission
uniform vec3 uHeat; uniform float uMode;                      // heat colour; spark mode (0 cooling embers, 1 random cyan/violet, 2 white glints)
`;

const BURST_VS = QUAD_VS + BURST_UNI + /* glsl */ `
void main(){
  float a = uTime - uBurst.x;
  float S = uBurst.y, sv = sqrt(S), kind = uBurst.z;
  float type = aB.z;
  float phi = aA.x * PI2;
  vec2 dir = vec2(cos(phi), sin(phi));
  vec3 org = uOrg;
  if (type < 0.5) {                                   // ── ring dust: low radial sheet with a rolling leading edge
    float ag = a - aA.y * 0.3;
    float life = 5.5 + 3.5 * aB.y;
    if (ag < 0.0 || ag > life) { qHide(); return; }
    float r0 = 7.0 + 8.0 * aA.z;
    float fast = step(0.38, aA.w);                    // ~60 % ride the shock front, the rest trail behind it
    float vr = (fast > 0.5 ? 30.0 + 16.0 * (aA.w - 0.38) / 0.62 : 6.0 + 22.0 * aA.w / 0.38) * sv * (1.0 + 0.22 * kind);
    float k = 0.45 + 0.20 * aB.x;
    float e = (1.0 - exp(-k * ag)) / k;
    float ps = aB.x * PI2 + ag * (1.1 + 0.9 * aB.y);
    float rho = (0.5 + 1.8 * aB.w) * smoothstep(0.0, 0.7, ag) * (1.0 - smoothstep(0.45 * life, life, ag)) * uTune.z * (0.4 + 0.6 * fast);
    float jit = (aB.y - 0.5) * 9.0 * smoothstep(0.0, 1.5, ag) * (0.4 + 0.6 * fast);          // ragged front
    float r = r0 + vr * e + rho * cos(ps) + jit;
    float sz = ((1.6 + 2.2 * aB.y) + (4.5 + 3.5 * aA.w) * (1.0 - exp(-ag / 2.5))) * (0.85 + 0.25 * sv);
    float lift = fast * (1.5 + 4.5 * aB.w * aB.w) * smoothstep(0.2, 1.8, ag) * (1.0 - smoothstep(0.4 * life, life, ag));   // the front bulges taller than the sheet behind it
    float h = 0.55 * sz + rho * (0.6 + 0.4 * sin(ps)) + 1.8 * (1.0 - exp(-ag / 3.5)) * (0.3 + aB.w) + lift;
    vec3 wp = org + vec3(dir.x * r + uWind.x * ag * ag * 0.05, h, dir.y * r + uWind.y * ag * ag * 0.05);
    float al = uTune.x * 0.30 * smoothstep(0.0, 0.16, ag) * (1.0 - smoothstep(0.28 * life, life, ag));
    float thr = 0.45 * smoothstep(0.3 * life, life, ag);
    qPuff(wp, sz, aA.y * PI2 + ag * (0.15 + 0.2 * aB.x), mix(uAlbA, uAlbB, aB.w), al, thr, vec3(0.0), 1.0, aA.w);
  } else if (type < 1.5) {                            // ── cloud: lofted, billowing, buoyant
    float ag = a - aA.y * 1.4;
    float life = 6.5 + 3.0 * aB.y;
    if (ag < 0.0 || ag > life) { qHide(); return; }
    float r0 = 2.0 + 7.0 * aA.z;
    float vr = (1.0 + 9.0 * aA.w) * sv;
    float k = 0.32;
    float e = (1.0 - exp(-k * ag)) / k;
    float vy0 = (2.0 + 10.0 * aB.x * aB.x) * sv * (1.0 + 0.7 * kind);          // lift-off: the exhaust drags a taller column of dust upward
    float vt = (0.9 + 0.9 * aB.y) / k;
    float y = (vy0 - vt) * e + vt * ag;
    float sz = ((2.4 + 2.6 * aB.w) + (7.5 + 6.0 * aA.w) * (1.0 - exp(-ag / 3.2))) * (0.85 + 0.25 * sv);
    float h = 0.4 * sz * smoothstep(0.0, 2.5, ag) + 1.0 + y * 0.85;
    float rr = r0 + vr * e;
    vec3 wp = org + vec3(dir.x * rr + uWind.x * ag * ag * 0.09, h, dir.y * rr + uWind.y * ag * ag * 0.09);
    float al = uTune.x * 0.32 * smoothstep(0.0, 0.3, ag) * (1.0 - smoothstep(0.22 * life, life, ag));
    float thr = 0.55 * smoothstep(0.25 * life, life, ag);
    vec3 em = uHeat * (uTune.w * exp(-ag * 1.4) * al);
    qPuff(wp, sz, aB.x * PI2 + ag * (0.10 + 0.14 * aB.y), mix(uAlbA, uAlbB, aB.w), al, thr, em, 1.0, aA.w);
  } else if (type < 2.5) {                            // ── grit: fast small specks on drag + gravity arcs
    float ag = a - aA.y * 0.2;
    float life = 1.0 + 3.0 * aB.y;
    if (ag < 0.0 || ag > life) { qHide(); return; }
    float ang = radians(4.0 + 42.0 * aB.x * aB.x);
    float v = (26.0 + 44.0 * aA.w) * sv * (1.0 + 0.2 * kind);
    float k = 0.20;
    float r0 = 6.0 + 9.0 * aA.z, y0 = 0.4 + 1.2 * aB.w;
    float hv = v * cos(ang), vy = v * sin(ang);
    float e = (1.0 - exp(-k * ag)) / k, e2 = (1.0 - exp(-k * max(ag - 0.03, 0.0))) / k;
    float ag2 = max(ag - 0.03, 0.0);
    vec3 ph = org + vec3(dir.x * (r0 + hv * e), y0 + (vy + uGrav / k) * e - uGrav * ag / k, dir.y * (r0 + hv * e));
    vec3 pt = org + vec3(dir.x * (r0 + hv * e2), y0 + (vy + uGrav / k) * e2 - uGrav * ag2 / k, dir.y * (r0 + hv * e2));
    if (ph.y < org.y) { qHide(); return; }
    float al = 0.55 * smoothstep(0.0, 0.08, ag) * (1.0 - smoothstep(0.6 * life, life, ag));
    qStreak(ph, pt, 0.018 + 0.03 * aB.y, uAlbG * (0.7 + 0.6 * aB.w), al);
  } else {                                            // ── sparks / embers / glints
    if (uTune.y < 0.001) { qHide(); return; }
    float ag = a - aA.y * 0.35;
    float life = 2.0 + 4.5 * aB.y;
    if (ag < 0.0 || ag > life) { qHide(); return; }
    float ang = radians(18.0 + 62.0 * aB.x);
    float v = (8.0 + 30.0 * aA.w) * sv * (1.0 + 0.2 * kind);
    float k = 0.16, g = uGrav * 0.35;
    float r0 = 4.0 + 10.0 * aA.z, y0 = 0.5 + 1.5 * aB.w;
    float e = (1.0 - exp(-k * ag)) / k;
    float hv = v * cos(ang), vy = v * sin(ang);
    vec3 wp = org + vec3(dir.x * (r0 + hv * e), y0 + (vy + g / k) * e - g * ag / k, dir.y * (r0 + hv * e));
    wp.xz += vec2(sin(ag * 3.1 + aA.z * 40.0), cos(ag * 2.7 + aB.x * 40.0)) * 0.35 * smoothstep(0.0, 1.5, ag);
    if (wp.y < org.y) { qHide(); return; }
    float heat = 1.0 - ag / life;
    float fl = 0.65 + 0.35 * sin(uTime * (11.0 + 17.0 * aB.w) + aA.z * 50.0);
    vec3 em; float glint = 0.0;
    if (uMode < 0.5) { em = mix(uEmB, uEmA, pow(heat, 1.4)) * (3.0 + 5.0 * aB.w) * fl; }
    else if (uMode < 1.5) { em = mix(uEmB, uEmA, step(0.5, aB.w)) * (2.0 + 4.0 * aA.z) * (0.6 + 0.4 * fl); glint = 0.6; }
    else { float tw = pow(0.5 + 0.5 * sin(uTime * (7.0 + 13.0 * aB.w) + aA.z * 60.0), 6.0); em = mix(uEmA, uEmB, 0.5 * aA.z) * (1.0 + 7.0 * tw); glint = 1.0; }
    float al = uTune.y * smoothstep(0.0, 0.1, ag) * (1.0 - smoothstep(0.7 * life, life, ag));
    qDot(wp, 0.05 + 0.08 * aB.y, em, al, glint, aA.w);
  }
  qFinish();
  #include <logdepthbuf_vertex>
}`;

// charon: airless, pure ballistics (no drag, no buoyancy, no billowing). Grains are velocity streaks; a thin veil of faint puffs follows the same arcs.
const CHARON_VS = QUAD_VS + BURST_UNI + /* glsl */ `
vec3 traj(float ag, float r0, vec2 dir, float hv, float vy, float y0){
  float r = r0 + hv * ag;
  return uOrg + vec3(dir.x * r, y0 + vy * ag - 0.5 * uGrav * ag * ag, dir.y * r);
}
void main(){
  float a = uTime - uBurst.x;
  float S = uBurst.y, sv = sqrt(S), kind = uBurst.z;
  float type = aB.z;
  float phi = aA.x * PI2;
  vec2 dir = vec2(cos(phi), sin(phi));
  if (type < 0.5) {                                   // grains
    float ag = a - aA.y * 0.10;
    float v = (7.0 + 38.0 * pow(aA.z, 1.25)) * sv * (1.0 + 0.2 * kind);
    float el = radians(5.0 + 52.0 * pow(aB.x, 1.8));
    float hv = v * cos(el), vy = v * sin(el);
    float r0 = 7.0 + 8.0 * aB.y, y0 = 0.4 + 1.6 * aB.w;
    float tf = (vy + sqrt(vy * vy + 2.0 * uGrav * y0)) / uGrav;
    float tEnd = min(tf, 19.0);
    if (ag < 0.0 || ag > tEnd) { qHide(); return; }
    vec3 ph = traj(ag, r0, dir, hv, vy, y0), pt = traj(max(ag - 0.06, 0.0), r0, dir, hv, vy, y0);
    float al = 0.9 * smoothstep(0.0, 0.05, ag) * (1.0 - smoothstep(tEnd - 0.5, tEnd, ag));
    qStreak(ph, pt, 0.04 + 0.09 * aA.w, uAlbA * (0.7 + 0.6 * aB.w), al);
  } else {                                            // veil: faint, ballistic, spreading by velocity dispersion
    float ag = a - aA.y * 0.10;
    float v = (6.0 + 24.0 * aA.z) * sv * (1.0 + 0.2 * kind);
    float el = radians(6.0 + 44.0 * aB.x * aB.x);
    float hv = v * cos(el), vy = v * sin(el);
    float r0 = 6.0 + 9.0 * aB.y, y0 = 1.0 + 2.0 * aB.w;
    float tf = (vy + sqrt(vy * vy + 2.0 * uGrav * y0)) / uGrav;
    float tEnd = min(tf, 13.0);
    if (ag < 0.0 || ag > tEnd) { qHide(); return; }
    vec3 wp = traj(ag, r0, dir, hv, vy, y0);
    float sz = 1.4 + (0.05 + 0.07 * aA.w) * v * ag;
    float al = uTune.x * 0.16 * smoothstep(0.0, 0.4, ag) * (1.0 - smoothstep(tEnd - 0.7, tEnd, ag)) / ((1.0 + 0.35 * ag) * (1.0 + 0.35 * ag));
    float thr = 0.15 + 0.45 * smoothstep(0.3 * tEnd, tEnd, ag);
    qPuff(wp, sz, aB.x * PI2 + ag * 0.2, uAlbA * (0.8 + 0.4 * aB.w), al, thr, vec3(0.0), 1.0, aA.w);
  }
  qFinish();
  #include <logdepthbuf_vertex>
}`;

const BURST = {
  asphodel:   { ring: 720, cloud: 400, grit: 600, spark: 0,   alb: [0.50, 0.54, 0.45], alb2: [0.40, 0.43, 0.35], gritAlb: [0.34, 0.33, 0.29], emA: [0, 0, 0], emB: [0, 0, 0], mode: 0, heat: [0, 0, 0], heatK: 0, alpha: 1.0, roll: 1.0 },
  phlegethon: { ring: 640, cloud: 360, grit: 440, spark: 700, alb: [0.085, 0.078, 0.072], alb2: [0.055, 0.05, 0.046], gritAlb: [0.06, 0.055, 0.05], emA: [1.0, 0.62, 0.20], emB: [0.85, 0.10, 0.02], mode: 0, heat: [1.0, 0.34, 0.07], heatK: 0.28, alpha: 1.1, roll: 1.0 },
  cocytus:    { ring: 680, cloud: 380, grit: 520, spark: 600, alb: [0.86, 0.92, 0.99], alb2: [0.74, 0.83, 0.94], gritAlb: [0.80, 0.86, 0.95], emA: [0.70, 0.92, 1.0], emB: [1.0, 1.0, 1.0], mode: 2, heat: [0, 0, 0], heatK: 0, alpha: 0.95, roll: 1.1, desat: 0.65, ambGain: 1.8 },
  elysium:    { ring: 560, cloud: 320, grit: 360, spark: 700, alb: [0.34, 0.42, 0.60], alb2: [0.24, 0.30, 0.48], gritAlb: [0.30, 0.38, 0.55], emA: [0.12, 0.85, 1.0], emB: [0.62, 0.28, 1.0], mode: 1, heat: [0.30, 0.55, 1.0], heatK: 0.14, alpha: 0.95, roll: 1.0, desat: 0.3, ambGain: 1.4 },
  charon:     { grain: 5000, veil: 760, alb: [0.22, 0.215, 0.205], alpha: 1.0 },
};

// ───────────────────────────── ambient shaders ─────────────────────────────
const BOX_WRAP = /* glsl */ `
// toroidal wrap of a world-fixed lattice position around the camera (xz); returns offset from the camera
vec2 wrapXZ(vec2 p, vec2 box){ return mod(p - uCam.xz + 0.5 * box, box) - 0.5 * box; }
float boxFade(vec2 rel, vec2 box){ vec2 q = abs(rel) / (0.5 * box); return (1.0 - smoothstep(0.68, 1.0, q.x)) * (1.0 - smoothstep(0.68, 1.0, q.y)); }
`;

const AMB_UNI = /* glsl */ `
uniform vec3 uBox; uniform vec2 uWindV; uniform float uGY;
`;

// asphodel: drifting pollen / seed fluff, sun-glinting
const POLLEN_VS = POINT_VS + AMB_UNI + BOX_WRAP + /* glsl */ `
void main(){
  vec3 r = position; vec4 b = aB; float t = uTime;
  vec3 p0 = r * uBox;
  p0.xz += uWindV * (0.55 + 0.9 * b.x) * t;
  float hy = mod(p0.y + (b.y - 0.55) * 0.22 * t, uBox.y);
  vec2 rel = wrapXZ(p0.xz, uBox.xz);
  vec3 sw = vec3(sin(t * 0.37 + b.z * PI2), 0.35 * sin(t * 0.51 + b.w * PI2), cos(t * 0.29 + b.y * PI2)) * (0.5 + b.x);
  vec3 wp = vec3(uCam.x + rel.x, uGY + 0.3 + hy, uCam.z + rel.y) + sw;
  float e = boxFade(rel, uBox.xz) * smoothstep(0.0, 0.6, hy) * (1.0 - smoothstep(0.7 * uBox.y, uBox.y, hy));
  float fs = pow(max(dot(normalize(wp - uCam), uSunDir), 0.0), 3.0);
  float tw = 0.55 + 0.45 * sin(t * (1.5 + 2.5 * b.w) + b.z * 40.0);
  vec3 col = vec3(0.95, 0.92, 0.80) * (uSunIrr * (0.5 + 2.4 * fs) + uSkyIrr * 0.6);
  pEmit(wp, 0.012 + 0.022 * b.x, col, 0.55 * e * tw, b.w > 0.9 ? 1.0 : 0.0, 0.7);
  #include <logdepthbuf_vertex>
}`;

// elysium: rising phosphor motes
const PHOSPHOR_VS = POINT_VS + AMB_UNI + BOX_WRAP + /* glsl */ `
void main(){
  vec3 r = position; vec4 b = aB; float t = uTime;
  vec3 p0 = r * uBox;
  p0.xz += uWindV * t;
  float hy = mod(p0.y + t * (0.10 + 0.34 * b.x), uBox.y);
  vec2 rel = wrapXZ(p0.xz, uBox.xz);
  vec3 sw = vec3(sin(t * 0.6 + b.z * PI2), 0.25 * sin(t * 0.9 + b.y * PI2), cos(t * 0.5 + b.y * PI2)) * (0.3 + 0.7 * b.w);
  vec3 wp = vec3(uCam.x + rel.x, uGY + 0.2 + hy, uCam.z + rel.y) + sw;
  float e = boxFade(rel, uBox.xz) * smoothstep(0.0, 1.0, hy) * (1.0 - smoothstep(0.6 * uBox.y, uBox.y, hy));
  float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(t * (0.8 + 2.4 * b.z) + b.y * 60.0), 2.0);
  vec3 col = mix(vec3(0.10, 0.80, 1.0), vec3(0.62, 0.28, 1.0), step(0.55, b.w)) * (1.2 + 2.4 * b.x);
  pEmit(wp, 0.05 + 0.10 * b.z, col, e * tw, 1.0, 0.35);
  #include <logdepthbuf_vertex>
}`;

// cocytus: diamond-dust glitter
const GLITTER_VS = POINT_VS + AMB_UNI + BOX_WRAP + /* glsl */ `
void main(){
  vec3 r = position; vec4 b = aB; float t = uTime;
  vec3 p0 = r * uBox;
  p0.xz += uWindV * (0.7 + 0.5 * b.x) * t;
  float hy = mod(p0.y - 0.15 * t * b.y, uBox.y);
  vec2 rel = wrapXZ(p0.xz, uBox.xz);
  vec3 wp = vec3(uCam.x + rel.x, uGY + 0.3 + hy, uCam.z + rel.y);
  float e = boxFade(rel, uBox.xz) * smoothstep(0.0, 0.5, hy) * (1.0 - smoothstep(0.7 * uBox.y, uBox.y, hy));
  float tw = pow(0.5 + 0.5 * sin(t * (3.0 + 9.0 * b.x) + b.y * 60.0), 10.0);
  float fs = 0.25 + 0.75 * pow(max(dot(normalize(wp - uCam), uSunDir), 0.0), 2.0);
  vec3 col = vec3(0.75, 0.93, 1.0) * (2.0 + 9.0 * fs) * uSunIrr.g * 3.0;
  pEmit(wp, 0.018 + 0.03 * b.z, col, e * tw, 1.0, 1.0);
  #include <logdepthbuf_vertex>
}`;

// phlegethon ash: slow dark flakes, lava-lit near the river
const RIVER_UNI = /* glsl */ `
uniform vec4 uRvA; uniform vec4 uRvB; uniform highp sampler2D uRY; uniform vec3 uRYp;
float riverX(float z){ return uRvA.x + uRvA.y * sin(PI2 * z / uRvA.z + uRvA.w) + uRvB.x * sin(PI2 * z / uRvB.y + uRvB.z); }
float riverY(float z){
  float f = clamp((z - uRYp.x) / uRYp.y, 0.0, uRYp.z - 1.001); int i = int(floor(f)); float fr = f - float(i);
  return mix(texelFetch(uRY, ivec2(i, 0), 0).r, texelFetch(uRY, ivec2(i + 1, 0), 0).r, fr);
}
`;
const ASH_VS = POINT_VS + AMB_UNI + BOX_WRAP + RIVER_UNI + /* glsl */ `
void main(){
  vec3 r = position; vec4 b = aB; float t = uTime;
  vec3 p0 = r * uBox;
  p0.xz += uWindV * (0.6 + 0.6 * b.x) * t;
  float hy = mod(p0.y - (0.5 + 1.0 * b.y) * t, uBox.y);
  vec2 rel = wrapXZ(p0.xz, uBox.xz);
  vec3 sw = vec3(sin(t * (0.8 + b.z) + b.w * PI2), 0.0, cos(t * (0.7 + b.x) + b.y * PI2)) * (0.25 + 0.5 * b.z);
  vec3 wp = vec3(uCam.x + rel.x, uGY + 0.2 + hy, uCam.z + rel.y) + sw;
  float e = boxFade(rel, uBox.xz) * smoothstep(0.0, 1.0, hy) * (1.0 - smoothstep(0.85 * uBox.y, uBox.y, hy));
  float lat = abs(wp.x - riverX(wp.z));
  float tum = 0.55 + 0.45 * sin(t * (2.0 + 4.0 * b.w) + b.x * 60.0);
  vec3 alb = vec3(0.05) + vec3(0.14) * step(0.7, b.z);
  vec3 col = alb * (uSunIrr * (0.6 + 0.6 * tum) + uSkyIrr) + vec3(0.55, 0.17, 0.04) * exp(-lat / 24.0) * 0.55 * (0.4 + 0.6 * tum);
  pEmit(wp, 0.018 + 0.03 * b.x, col, 0.8 * e, 0.0, 0.0);
  #include <logdepthbuf_vertex>
}`;

// phlegethon embers: spawn on the lava surface, rise, cool, die
const EMBER_VS = POINT_VS + AMB_UNI + BOX_WRAP + RIVER_UNI + /* glsl */ `
float hh(float x){ return fract(sin(x * 12.9898) * 43758.5453); }
void main(){
  vec3 r = position; vec4 b = aB; float t = uTime;
  float Lz = uBox.z;
  float T = 3.0 + 4.0 * b.x;
  float cyc = floor((t + b.y * T) / T), ag = mod(t + b.y * T, T);
  float h1 = hh(cyc * 1.7 + r.y * 91.3), h2 = hh(cyc * 3.1 + r.z * 57.7 + 5.0);
  float zb = r.x * Lz + h1 * 41.0;
  float zw = uCam.z + mod(zb - uCam.z + 0.5 * Lz, Lz) - 0.5 * Lz;
  float lat = (h2 * 2.0 - 1.0) * uRvB.w * 1.15;
  float rise = (3.0 + 5.0 * b.z) * (1.0 - exp(-ag / 2.2)) * 2.2;
  vec3 wp = vec3(riverX(zw) + lat, riverY(zw) + 0.25 + rise, zw);
  wp.xz += uWindV * ag * (0.6 + 0.04 * ag * ag) + vec2(sin(ag * 2.3 + r.z * 40.0), cos(ag * 1.9 + r.y * 40.0)) * 0.5 * smoothstep(0.0, 2.0, ag);
  float zr = abs(zw - uCam.z) / (0.5 * Lz);
  float e = (1.0 - smoothstep(0.7, 1.0, zr)) * smoothstep(0.0, 0.15, ag) * (1.0 - smoothstep(0.55 * T, T, ag));
  float heat = 1.0 - ag / T;
  float fl = 0.6 + 0.4 * sin(t * (9.0 + 14.0 * b.w) + r.x * 90.0);
  vec3 col = mix(vec3(0.85, 0.10, 0.02), vec3(1.0, 0.62, 0.20), pow(heat, 1.3)) * (3.0 + 5.0 * b.w) * fl;
  pEmit(wp, 0.035 + 0.05 * b.w, col, e, 0.0, 0.0);
  #include <logdepthbuf_vertex>
}`;

// phlegethon smoke plumes rising from fixed vents beside the river
const SMOKE_VS = QUAD_VS + AMB_UNI + RIVER_UNI + /* glsl */ `
float hh(float x){ return fract(sin(x * 12.9898) * 43758.5453); }
void main(){
  float t = uTime, Lz = uBox.z;
  float pi = floor(aA.x + 0.5);
  float zb = (pi + 0.2 + 0.6 * hh(pi * 3.7 + 1.0)) * (Lz / aA.w);
  float zs = uCam.z + mod(zb - uCam.z + 0.5 * Lz, Lz) - 0.5 * Lz;
  float lat0 = (hh(pi * 5.3 + 2.0) * 2.0 - 1.0) * uRvB.w * 2.4;
  float T = 11.0;
  float ag = mod(t + aA.y * T, T);
  float y = 26.0 * (1.0 - exp(-ag / 4.5)) * (0.8 + 0.4 * aA.z);
  vec2 sp = vec2(riverX(zs) + lat0, zs);
  vec2 off = vec2(sin(ag * 0.9 + aB.x * PI2), cos(ag * 0.8 + aB.y * PI2)) * (0.8 + 0.5 * ag) * (0.6 + 0.4 * aB.w);
  vec3 wp = vec3(sp.x, riverY(zs) + 1.5 + y, sp.y);
  wp.xz += off + uWindV * (ag * ag * 0.42);
  float sz = 1.6 + 0.85 * ag * (0.7 + 0.6 * aB.w);
  float zr = abs(zs - uCam.z) / (0.5 * Lz);
  float al = 0.30 * smoothstep(0.0, 1.2, ag) * (1.0 - smoothstep(0.5 * T, T, ag)) * (1.0 - smoothstep(0.7, 1.0, zr));
  vec3 em = vec3(1.0, 0.33, 0.07) * (0.5 * exp(-ag * 0.55) * al);
  qPuff(wp, sz, aB.z * PI2 + ag * 0.1, vec3(0.075, 0.065, 0.06), al, 0.4 * smoothstep(0.4 * T, T, ag), em, 1.0, aB.w);
  qFinish();
  #include <logdepthbuf_vertex>
}`;

// cocytus: wind-blown snow streaks hugging the ground
const SNOW_VS = QUAD_VS + AMB_UNI + BOX_WRAP + /* glsl */ `
void main(){
  vec3 r = aA.xyz; vec4 b = aB; float t = uTime;
  vec2 wd = normalize(uWindV + vec2(1e-4));
  float sp = length(uWindV) * (0.55 + 0.7 * b.x);
  vec3 p0 = r * uBox;
  p0.xz += wd * sp * t;
  float h = pow(r.y, 3.0) * uBox.y + 0.10 + 0.04 * sin(t * 2.0 + b.y * PI2);
  vec2 rel = wrapXZ(p0.xz, uBox.xz);
  float gust = 0.55 + 0.45 * sin(t * 0.45 + dot(p0.xz, wd) * 0.02 + b.w * 3.0);
  vec3 wp = vec3(uCam.x + rel.x, uGY + h, uCam.z + rel.y);
  wp.xz += vec2(-wd.y, wd.x) * sin(t * 1.3 + b.z * PI2) * 0.35;
  float len = (0.55 + 0.07 * sp) * (0.6 + 0.8 * b.z) * (0.6 + 0.6 * gust);
  vec3 tail = wp - vec3(wd.x, 0.0, wd.y) * len;
  float al = 0.55 * boxFade(rel, uBox.xz) * gust * (1.0 - 0.6 * r.y);
  qStreak(wp, tail, 0.016 + 0.024 * b.y, vec3(1.35, 1.42, 1.55), al);
  qFinish();
  #include <logdepthbuf_vertex>
}`;

// cocytus: spindrift — long low translucent banks of snow racing along the ground with the wind
const SPINDRIFT_VS = QUAD_VS + AMB_UNI + BOX_WRAP + /* glsl */ `
void main(){
  vec3 r = aA.xyz; vec4 b = aB; float t = uTime;
  vec2 wd = normalize(uWindV + vec2(1e-4));
  float sp = length(uWindV) * (0.45 + 0.4 * b.x);
  vec3 p0 = r * uBox; p0.xz += wd * sp * t;
  vec2 rel = wrapXZ(p0.xz, uBox.xz);
  vec3 wp = vec3(uCam.x + rel.x, uGY + 0.5 + 3.4 * r.y * r.y, uCam.z + rel.y);
  float gust = 0.5 + 0.5 * sin(t * 0.25 + dot(p0.xz, wd) * 0.015 + b.w * 6.0);
  vec2 ax = (viewMatrix * vec4(wd.x, 0.0, wd.y, 0.0)).xy; float al2 = length(ax);
  float spin = al2 > 1e-3 ? atan(ax.y, ax.x) : 0.0;
  gStretch = 1.0 + 2.4 * smoothstep(0.0, 0.5, al2);
  float a = 0.10 * boxFade(rel, uBox.xz) * (0.3 + 0.7 * gust);
  qPuff(wp, 3.5 + 6.5 * b.y, spin, vec3(0.95, 1.0, 1.1), a, 0.15, vec3(0.0), 1.0, b.z);
  qFinish();
  #include <logdepthbuf_vertex>
}`;

// asphodel/shore: sea spray along the surf line — soft mist banks + flying droplets, drifting inland on the wind
const SHORE_GLSL = /* glsl */ `
uniform vec4 uCoast; uniform vec3 uCoastP; uniform highp sampler2D uCS; uniform float uSeaY; uniform vec2 uWindV;
float hh(float x){ return fract(sin(x * 12.9898) * 43758.5453); }
float shoreS(float a){
  float f = clamp((a - uCoastP.x) / uCoastP.y, 0.0, uCoastP.z - 1.001); int i = int(floor(f)); float fr = f - float(i);
  return mix(texelFetch(uCS, ivec2(i, 0), 0).r, texelFetch(uCS, ivec2(i + 1, 0), 0).r, fr);
}
`;
const SPRAY_VS = QUAD_VS + SHORE_GLSL + /* glsl */ `
void main(){
  vec4 b = aB; vec4 A = aA; float t = uTime;
  float Wa = 300.0;
  float ac = dot(uCam.xz, uCoast.xy);
  float T = 4.0 + 3.0 * b.x;
  float cyc = floor((t + A.y * T) / T), ag = mod(t + A.y * T, T);
  float h1 = hh(cyc * 1.37 + A.z * 91.7), h2 = hh(cyc * 2.9 + A.w * 53.1 + 7.0);
  float a = ac + mod(A.x * Wa + h1 * 41.0 - ac + 0.5 * Wa, Wa) - 0.5 * Wa;
  vec2 base = uCoast.xy * a + uCoast.zw * (shoreS(a) - 2.0 + 12.0 * h2);
  float set = smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(a * 0.045 + t * 0.6));
  vec2 xz = base + (-uCoast.zw * (0.8 + 1.4 * b.y) + uWindV * 0.5) * ag;
  float sz = 2.2 + 3.0 * b.w + 0.9 * ag;
  vec3 wp = vec3(xz.x, uSeaY + 0.5 + 0.5 * sz + 0.9 * ag * (0.5 + b.z), xz.y);
  float fade = (1.0 - smoothstep(0.6, 1.0, abs(a - ac) / (0.5 * Wa))) * (1.0 - smoothstep(80.0, 220.0, length(xz - uCam.xz)));
  float al = 0.13 * set * fade * smoothstep(0.0, 0.8, ag) * (1.0 - smoothstep(0.35 * T, T, ag));
  qPuff(wp, sz, b.w * PI2 + ag * 0.15, vec3(1.0, 1.02, 1.04), al, 0.1 + 0.4 * smoothstep(0.3 * T, T, ag), vec3(0.0), 3.0, A.w);
  qFinish();
  #include <logdepthbuf_vertex>
}`;
const DROPLET_VS = POINT_VS + SHORE_GLSL + /* glsl */ `
void main(){
  vec3 r = position; vec4 b = aB; float t = uTime;
  float Wa = 300.0;
  float ac = dot(uCam.xz, uCoast.xy);
  float T = 1.1 + 1.3 * b.x;
  float cyc = floor((t + r.y * T) / T), ag = mod(t + r.y * T, T);
  float h1 = hh(cyc * 1.37 + r.z * 91.7), h2 = hh(cyc * 2.9 + b.w * 53.1 + 7.0);
  float a = ac + mod(r.x * Wa + h1 * 41.0 - ac + 0.5 * Wa, Wa) - 0.5 * Wa;
  vec2 base = uCoast.xy * a + uCoast.zw * (shoreS(a) - 1.0 + 9.0 * h2);
  float set = smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(a * 0.045 + t * 0.7));
  vec2 xz = base + (-uCoast.zw * (1.2 + 3.0 * b.y) + uWindV * 0.7) * ag;
  float y = uSeaY + 0.1 + (3.0 + 7.0 * b.z) * ag - 3.5 * ag * ag;
  if (y < uSeaY) { pHide(); return; }
  vec3 wp = vec3(xz.x, y, xz.y);
  float fade = (1.0 - smoothstep(0.6, 1.0, abs(a - ac) / (0.5 * Wa))) * (1.0 - smoothstep(60.0, 170.0, length(xz - uCam.xz)));
  float gl = pow(max(dot(normalize(wp - uCam), uSunDir), 0.0), 3.0);
  vec3 col = vec3(1.0, 1.0, 1.03) * (uSkyIrr * 1.6 + uSunIrr * (0.7 + 3.0 * gl));
  pEmit(wp, 0.05 + 0.07 * b.w, col, 0.8 * set * fade * smoothstep(0.0, 0.15, ag) * (1.0 - smoothstep(0.7 * T, T, ag)), 0.0, 0.0);
  #include <logdepthbuf_vertex>
}`;

// ───────────────────────────── geysers (cocytus) ─────────────────────────────
const GEYSER_UNI = /* glsl */ `
uniform vec4 uVent[NV]; uniform vec4 uVP[NV]; uniform vec3 uWind3;
`;
const GEYSER_VS = QUAD_VS + GEYSER_UNI + /* glsl */ `
void main(){
  int vi = int(aA.x + 0.5);
  vec4 V = uVent[vi]; vec4 P = uVP[vi];
  float H = P.x, D = P.y, u = V.w, hz = P.z;
  float tau = 0.8 + 0.5 * sqrt(H / 220.0);
  float ty = aB.z;
  vec3 wp; float sz, al, thr; vec3 em = vec3(0.0);
  if (ty < 0.5) {                                     // ── jet column
    float e = D * pow(aA.y, 1.15);
    float ag = u - e;
    float Lf = 3.0 + 2.4 * aA.z;
    if (ag < 0.0 || ag > Lf) { qHide(); return; }
    float Hj = H * (0.44 + 0.56 * aA.w);
    float y = Hj * (1.0 - exp(-ag / tau));
    float Rc = 1.4 + 0.10 * y;
    float ang = aB.x * PI2 + ag * (0.6 + 0.8 * aB.y);
    float rad = (0.2 + 0.8 * sqrt(aB.y)) * Rc * 0.7;
    vec2 lat = vec2(cos(ang), sin(ang)) * rad;
    float bend = uWind3.z * 0.55 * y * y / (H + 90.0);
    vec2 xz = V.xz + lat + uWind3.xy * bend;
    float rt = 2.3 * tau;
    float cs = smoothstep(0.8 * rt, 1.5 * rt, ag) * smoothstep(0.55, 0.9, y / H);
    float ss = max(ag - rt, 0.0);
    xz += lat / max(rad, 0.5) * cs * 0.22 * H * (1.0 - exp(-ss / 2.2)) * (0.4 + 0.6 * aB.w);
    wp = vec3(xz.x, V.y + y - cs * ss * 0.9, xz.y);
    sz = (2.0 + 0.10 * y) * (0.75 + 0.5 * smoothstep(0.0, 2.5, ag) + 0.8 * cs);
    float fade = smoothstep(0.0, 0.10, ag) * (1.0 - smoothstep(0.5 * Lf, Lf, ag));
    al = 0.40 * fade;
    thr = 0.4 * smoothstep(0.45 * Lf, Lf, ag);
    em = vec3(0.55, 0.80, 1.0) * (2.6 * exp(-y / (0.30 * H + 10.0)) * exp(-ag * 0.55) * fade);
  } else if (ty < 1.5) {                              // ── umbrella cap: spreads at the plume top and rolls like a mushroom torus
    float e = D * (0.30 + 0.55 * aA.y);
    float ag = u - e;
    float Lf = 5.5 + 1.8 * aA.z;
    if (ag < 0.0 || ag > Lf) { qHide(); return; }
    float Hj = H * (0.90 + 0.10 * aA.w);
    float y = Hj * (1.0 - exp(-ag / tau));
    float ang = aB.x * PI2;
    float ss = max(ag - 2.0 * tau, 0.0);
    float Rrim = 0.28 * H + 8.0;
    float ph = aB.y * PI2 + ss * 0.9;
    float rr = Rrim * (1.0 - exp(-ss / 2.6)) * (0.30 + 0.70 * sqrt(aB.y)) + 2.0 + 0.04 * y + Rrim * 0.10 * cos(ph) * smoothstep(0.0, 2.0, ss);
    float bend = uWind3.z * 0.55 * y * y / (H + 90.0);
    vec2 xz = V.xz + vec2(cos(ang), sin(ang)) * rr + uWind3.xy * bend;
    wp = vec3(xz.x, V.y + y - 0.6 * ss + (aB.w - 0.5) * 0.08 * H + Rrim * 0.07 * sin(ph) * smoothstep(0.0, 2.0, ss), xz.y);
    sz = (6.0 + 0.11 * H) * (0.35 + 0.65 * smoothstep(0.0, 3.0, ag)) * (0.6 + 0.6 * aB.w);
    al = 0.36 * smoothstep(0.0, 0.5, ag) * (1.0 - smoothstep(0.45 * Lf, Lf, ag));
    thr = 0.45 * smoothstep(0.4 * Lf, Lf, ag);
  } else if (ty < 2.5) {                              // ── low steam haze hugging the vent
    float th = aA.y * PI2 + uTime * 0.05 * (aB.x - 0.5);
    float rr = 3.0 + 28.0 * aA.z * aA.z + 6.0 * aA.z;
    sz = (5.0 + 9.0 * aB.y) * (0.8 + 0.4 * hz);
    vec2 xz = V.xz + vec2(cos(th), sin(th)) * rr + uWind3.xy * (3.0 + 5.0 * aB.y) * sin(uTime * 0.07 + aA.w * 6.0);
    wp = vec3(xz.x, V.y + 0.5 + 0.35 * sz + 2.0 * aA.w, xz.y);
    al = 0.075 * hz * (0.5 + 0.5 * aB.w);
    thr = 0.1;
  } else {                                            // ── wisps rising from the vent between eruptions
    float T = 7.0 + 3.0 * aB.x;
    float ag = mod(uTime + aA.y * T, T);
    float y = 14.0 * (1.0 - exp(-ag / 3.0));
    vec2 xz = V.xz + vec2(cos(aB.y * PI2), sin(aB.y * PI2)) * (1.0 + 2.0 * aA.z) + uWind3.xy * (ag * ag * 0.5 + 0.3 * ag);
    wp = vec3(xz.x, V.y + 0.8 + y, xz.y);
    sz = 1.8 + 1.5 * ag * (0.6 + 0.5 * aB.w);
    al = 0.16 * (0.5 + 0.5 * hz) * smoothstep(0.0, 0.8, ag) * (1.0 - smoothstep(0.45 * T, T, ag));
    thr = 0.2 + 0.4 * smoothstep(0.4 * T, T, ag);
  }
  qPuff(wp, sz, aA.y * 37.0 + aB.x * PI2, vec3(0.95, 1.03, 1.16), al, thr, em, 4.0, aB.w);
  qFinish();
  #include <logdepthbuf_vertex>
}`;

// falling ice crystals shed from the plume
const CRYSTAL_VS = POINT_VS + GEYSER_UNI + /* glsl */ `

void main(){
  vec4 b = aB;
  int vi = int(b.w + 0.5);
  vec4 V = uVent[vi]; vec4 P = uVP[vi];
  float H = P.x, D = P.y, u = V.w;
  vec3 r = position;
  float tau = 0.8 + 0.5 * sqrt(H / 220.0);
  float yb = H * (0.12 + 0.82 * r.z);
  float treach = -tau * log(max(1.0 - 0.9 * yb / H, 0.05));
  float e = max((0.25 + 0.75 * b.x) * (D + 2.0), treach + 0.1);
  float ag = u - e;
  float life = 3.4 + 2.0 * b.y;
  if (ag < 0.0 || ag > life) { pHide(); return; }
  float Rc = 1.4 + 0.10 * yb;
  float ang = r.x * PI2;
  vec2 lat = vec2(cos(ang), sin(ang)) * Rc * (0.4 + 0.9 * r.y);
  float vt = 5.0 + 11.0 * b.y;
  float vo = 2.0 + 8.0 * r.y;
  float bend = uWind3.z * 0.55 * yb * yb / (H + 90.0);
  vec2 xz = V.xz + lat + uWind3.xy * bend + lat / max(length(lat), 0.5) * vo * (1.0 - exp(-0.5 * ag)) * 2.0 + uWind3.xy * uWind3.z * 3.0 * ag;
  float y = V.y + yb - vt * ag;
  if (y < V.y) { pHide(); return; }
  float tw = pow(0.5 + 0.5 * sin(uTime * (6.0 + 12.0 * b.y) + r.x * 70.0), 5.0);
  float fs = 0.3 + 0.7 * pow(max(dot(normalize(vec3(xz.x, y, xz.y) - uCam), uSunDir), 0.0), 1.5);
  vec3 col = vec3(0.78, 0.94, 1.0) * (0.9 + 8.0 * tw * fs) * (0.6 + 0.4 * uSunIrr.g * 3.0);
  float fade = smoothstep(0.0, 0.25, ag) * (1.0 - smoothstep(0.55 * life, life, ag));
  vec3 cp = vec3(xz.x, y, xz.y);
  pEmit(cp, (0.35 + 0.55 * b.y) * clamp(length(cp - uCam) / 60.0, 0.12, 1.0), col, fade, 1.0, 1.0);
  #include <logdepthbuf_vertex>
}`;

// ───────────────────────────── builder ─────────────────────────────
const QUAD_POS = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
const QUAD_IDX = new Uint16Array([0, 1, 2, 0, 2, 3]);

function quadGeometry(A, B, n) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(QUAD_POS, 3));
  g.setIndex(new THREE.BufferAttribute(QUAD_IDX, 1));
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(B, 4));
  g.instanceCount = n;
  return g;
}
function pointGeometry(P, B, n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('aB', new THREE.BufferAttribute(B, 4));
  g.setDrawRange(0, n);
  return g;
}

export function createSurfaceFx(env) {
  const biome = env.biome;
  const site = env.site || {};
  const siteId = env.siteId || site.id || 'site';
  const look = LOOKS[biome] || LOOKS.asphodel;
  const gravity = (BODY_FALLBACK[biome]?.g ?? 0.8) * 9.81;
  const wcfg = WIND[biome] || WIND.asphodel;
  const wAmt = clamp(site.wind ?? 0.4, 0, 1.2);
  const windV = new THREE.Vector2(wcfg.d[0] * wcfg.v * wAmt, wcfg.d[1] * wcfg.v * wAmt);
  const baseSeed = strHash(`${biome}:${siteId}`);
  const group = new THREE.Group(); group.name = 'surface-fx';

  const U = {
    uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunIrr: { value: new THREE.Vector3() }, uSkyIrr: { value: new THREE.Vector3() }, uGndIrr: { value: new THREE.Vector3() },
    uViewH: { value: 720 }, uAmbN: { value: 6 },
    // mirror of the live Atmosphere uniforms (copied from the sky dome each frame; uAtOn = 0 when airless / not found)
    uAtSun: { value: new THREE.Vector3(0, 1, 0) }, uAtSunCol: { value: new THREE.Vector3() }, uAtBeta: { value: new THREE.Vector3() }, uAtMie: { value: 0 }, uAtG: { value: 0.7 },
    uAtMieCol: { value: new THREE.Vector3(1, 1, 1) }, uAtGain: { value: 1 }, uAtFogExt: { value: new THREE.Vector3() }, uAtGround: { value: new THREE.Vector3() },
    uAtAmb: { value: 0 }, uAtOn: { value: 0 }, uAtTwi: { value: 0 },
  };
  const ATMO_KEYS = ['uAtSun', 'uAtSunCol', 'uAtBeta', 'uAtMie', 'uAtG', 'uAtMieCol', 'uAtGain', 'uAtFogExt', 'uAtGround', 'uAtAmb', 'uAtOn', 'uAtTwi'];
  const tex = makePuffTexture();
  const own = { geos: [], mats: [], textures: [tex] };
  const updaters = [];
  const _v2 = new THREE.Vector2();
  const onBefore = (renderer) => { const rt = renderer.getRenderTarget(); U.uViewH.value = rt ? rt.height : renderer.getDrawingBufferSize(_v2).y; };

  const mkMat = (vs, fs, uniforms, defines, extra) => {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, U, uniforms), vertexShader: vs, fragmentShader: fs, defines: defines || {},
      transparent: true, depthWrite: false, depthTest: true, premultipliedAlpha: true, side: THREE.DoubleSide, fog: false, ...(extra || {}),
    });
    m.toneMapped = false; own.mats.push(m); return m;
  };
  const addMesh = (Ctor, geo, mat, order) => {
    const o = new Ctor(geo, mat); o.frustumCulled = false; o.renderOrder = order; o.onBeforeRender = onBefore; own.geos.includes(geo) || own.geos.push(geo);
    group.add(o); return o;
  };
  const quadMat = (uniforms, vs, defines) => mkMat(vs, QUAD_FS, Object.assign({ uTex: { value: tex }, uDesat: { value: 0 }, uAmbGain: { value: 1 } }, uniforms), defines);
  const pointMat = (vs, uniforms, additive, defines) => mkMat(vs, POINT_FS, uniforms, Object.assign({}, defines, additive ? { ADDITIVE: 1 } : {}));

  // ── lights (picked up from the scene by name; falls back to the biome's authored look) ──
  let sunL = null, hemiL = null, lightTimer = 0;
  const scene = env.ctx?.scenes?.near || null;
  function findLights() {
    if (!scene) return;
    if (!sunL || !sunL.parent) sunL = scene.getObjectByName('surface-sun') || null;
    if (!hemiL || !hemiL.parent) hemiL = scene.getObjectByName('surface-hemi') || null;
  }
  let domeU = null, domeTimer = 0;
  function syncAtmo(dt) {
    if (!domeU && scene && (domeTimer -= dt) <= 0) { domeTimer = 1; const u = scene.getObjectByName('sky-dome')?.children?.[0]?.material?.uniforms; domeU = u && u.uAtSun ? u : null; }
    if (!domeU) { U.uAtOn.value = 0; return; }
    for (let i = 0; i < ATMO_KEYS.length; i++) { const k = ATMO_KEYS[i], s = domeU[k].value; if (typeof s === 'number') U[k].value = s; else U[k].value.copy(s); }
  }
  function refreshLights(dt) {
    lightTimer -= dt; if ((!sunL || !hemiL || !sunL.parent || !hemiL.parent) && lightTimer <= 0) { findLights(); lightTimer = 1.0; }
    syncAtmo(dt);
    const iP = 1 / Math.PI;
    if (sunL && sunL.parent) U.uSunIrr.value.set(sunL.color.r, sunL.color.g, sunL.color.b).multiplyScalar(sunL.intensity * iP);
    else { const k = look.sunI * iP * smooth(-0.05, 0.2, U.uSunDir.value.y); U.uSunIrr.value.set(look.sunCol[0] * k, look.sunCol[1] * k, look.sunCol[2] * k); }
    if (hemiL && hemiL.parent) {
      const k = hemiL.intensity * iP;
      U.uSkyIrr.value.set(hemiL.color.r * k, hemiL.color.g * k, hemiL.color.b * k);
      U.uGndIrr.value.set(hemiL.groundColor.r * k, hemiL.groundColor.g * k, hemiL.groundColor.b * k);
    } else {
      const k = look.hemiI * iP;
      U.uSkyIrr.value.set(look.hemiSky[0] * k, look.hemiSky[1] * k, look.hemiSky[2] * k);
      U.uGndIrr.value.set(look.hemiGround[0] * k, look.hemiGround[1] * k, look.hemiGround[2] * k);
    }
  }

  let lastT = 0, gyCam = env.groundY ? env.groundY(env.shipPad?.x ?? 0, env.shipPad?.z ?? 18) : 0, gyTimer = 0;

  // ═════════════════════════════ bursts ═════════════════════════════
  const burstCfg = BURST[biome] || BURST.asphodel;
  const airless = biome === 'charon';
  const burstSlots = [];
  const BURST_LIFE = airless ? 20.5 : 11.0;
  {
    const rng = mulberry(baseSeed ^ 0xb0057);
    const kinds = airless ? [{ type: 0, n: burstCfg.grain, strat: true }, { type: 1, n: burstCfg.veil, strat: true }]
      : [{ type: 0, n: burstCfg.ring, strat: true }, { type: 1, n: burstCfg.cloud, strat: true }, { type: 2, n: burstCfg.grit, strat: false }, { type: 3, n: burstCfg.spark, strat: false }];
    let n = 0; for (const k of kinds) n += k.n;
    const A = new Float32Array(n * 4), B = new Float32Array(n * 4);
    let o = 0;
    for (const k of kinds) for (let i = 0; i < k.n; i++, o++) {
      A[o * 4] = k.strat ? (i + rng()) / k.n : rng(); A[o * 4 + 1] = rng(); A[o * 4 + 2] = rng(); A[o * 4 + 3] = rng();
      B[o * 4] = rng(); B[o * 4 + 1] = rng(); B[o * 4 + 2] = k.type; B[o * 4 + 3] = rng();
    }
    const geo = quadGeometry(A, B, n);
    const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    for (let s = 0; s < 2; s++) {
      const uni = {
        uBurst: { value: new THREE.Vector4(-1e6, 1, 0, 0) }, uOrg: { value: new THREE.Vector3() }, uGrav: { value: gravity }, uWind: { value: windV },
        uAlbA: { value: v3(airless ? burstCfg.alb : burstCfg.alb) }, uAlbB: { value: v3(airless ? burstCfg.alb : burstCfg.alb2) }, uAlbG: { value: v3(airless ? burstCfg.alb : burstCfg.gritAlb) },
        uEmA: { value: v3(airless ? [0, 0, 0] : burstCfg.emA) }, uEmB: { value: v3(airless ? [0, 0, 0] : burstCfg.emB) },
        uTune: { value: new THREE.Vector4(burstCfg.alpha ?? 1, burstCfg.spark === 0 ? 0 : 1, burstCfg.roll ?? 1, burstCfg.heatK ?? 0) },
        uHeat: { value: v3(airless ? [0, 0, 0] : burstCfg.heat) }, uMode: { value: burstCfg.mode ?? 0 }, uDesat: { value: burstCfg.desat ?? 0 }, uAmbGain: { value: burstCfg.ambGain ?? 1 },
      };
      const mat = quadMat(uni, airless ? CHARON_VS : BURST_VS, {});
      const mesh = addMesh(THREE.Mesh, geo, mat, 12 + s);
      mesh.visible = false; mesh.name = `fx-burst-${s}`;
      burstSlots.push({ mesh, mat, uni, t0: -1e9, active: false });
    }
  }
  function burst(kind, x, z, strength = 1) {
    let slot = null;
    for (const s of burstSlots) if (!s.active) { slot = s; break; }
    if (!slot) slot = burstSlots[0].t0 <= burstSlots[1].t0 ? burstSlots[0] : burstSlots[1];
    const gy = env.groundY ? env.groundY(x, z) : -4.6;
    slot.active = true; slot.t0 = lastT; slot.mesh.visible = true;
    slot.uni.uBurst.value.set(lastT, clamp(strength, 0.15, 3), kind === 'liftoff' ? 1 : 0, 0);
    slot.uni.uOrg.value.set(x, gy, z);
  }

  // ═════════════════════════════ ambient ═════════════════════════════
  const rngA = mulberry(baseSeed ^ 0xa3b1e);
  const ptsRand = (n, fillB) => { const P = new Float32Array(n * 3), B = new Float32Array(n * 4); for (let i = 0; i < n; i++) { P[i * 3] = rngA(); P[i * 3 + 1] = rngA(); P[i * 3 + 2] = rngA(); B[i * 4] = rngA(); B[i * 4 + 1] = rngA(); B[i * 4 + 2] = rngA(); B[i * 4 + 3] = rngA(); if (fillB) fillB(i, P, B); } return { P, B }; };
  const boxUni = (bx, by, bz) => ({ uBox: { value: new THREE.Vector3(bx, by, bz) }, uWindV: { value: windV }, uGY: { value: gyCam } });
  const ambGY = [];   // uGY uniforms to refresh
  const ambient = (Ctor, geo, mat, order, gyU) => { addMesh(Ctor, geo, mat, order); if (gyU) ambGY.push(gyU); };

  // river profile (lava surface height along z), baked lazily from the CPU heightfield
  let riverTex = null, riverBake = null;
  const river = env.features?.river || null;
  function riverUniforms() {
    const Z0 = -760, DZ = 4, NZ = 384;
    const data = new Float32Array(NZ).fill(env.groundY ? env.groundY(env.shipPad?.x ?? 0, env.shipPad?.z ?? 18) : -4.6);
    riverTex = new THREE.DataTexture(data, NZ, 1, THREE.RedFormat, THREE.FloatType);
    riverTex.magFilter = riverTex.minFilter = THREE.NearestFilter; riverTex.generateMipmaps = false; riverTex.needsUpdate = true; own.textures.push(riverTex);
    // fill order: nearest to the ship first; a few samples per frame so no single frame pays for the CPU heightfield
    const order = Array.from({ length: NZ }, (_, i) => i).sort((a, b) => Math.abs(Z0 + a * DZ - 18) - Math.abs(Z0 + b * DZ - 18));
    riverBake = { data, order, next: 0, Z0, DZ, NZ };
    return {
      uRvA: { value: new THREE.Vector4(river.x0, river.a1, river.l1, river.p1) }, uRvB: { value: new THREE.Vector4(river.a2, river.l2, river.p2, river.wLava) },
      uRY: { value: riverTex }, uRYp: { value: new THREE.Vector3(Z0, DZ, NZ) },
    };
  }
  function stepRiverBake(count) {
    const b = riverBake; if (!b || b.next >= b.NZ) return;
    for (let k = 0; k < count && b.next < b.NZ; k++) { const i = b.order[b.next++], z = b.Z0 + i * b.DZ; b.data[i] = env.groundY(river.cx(z), z); }
    riverTex.needsUpdate = true;
  }

  const sprayMeshes = []; let coast = null;
  if (biome === 'asphodel') {
    const { P, B } = ptsRand(1500);
    const uni = boxUni(64, 16, 64);
    ambient(THREE.Points, pointGeometry(P, B, 1500), pointMat(POLLEN_VS, uni, false), 8, uni.uGY);
    coast = env.features?.coast || null;
    if (coast && env.groundY) { // sea spray along the surf line (shore site only)
      const tx = -coast.n[1], tz = coast.n[0], A0 = -900, DA = 4, NA = 451, prof = new Float32Array(NA);
      for (let i = 0; i < NA; i++) { const a = A0 + i * DA; prof[i] = coast.landDist(a * tx, a * tz); }   // shoreline distance along n, per tangential coordinate
      const ys = []; for (const a of [-300, -150, 0, 150, 300]) { const s = prof[Math.round((a - A0) / DA)]; ys.push(env.groundY(a * tx + s * coast.n[0], a * tz + s * coast.n[1])); }
      ys.sort((p, q) => p - q);
      const tex1 = new THREE.DataTexture(prof, NA, 1, THREE.RedFormat, THREE.FloatType);
      tex1.magFilter = tex1.minFilter = THREE.NearestFilter; tex1.generateMipmaps = false; tex1.needsUpdate = true; own.textures.push(tex1);
      const n = 90, A = new Float32Array(n * 4), BB = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { A[i * 4 + k] = rngA(); BB[i * 4 + k] = rngA(); }
      const su = { uCoast: { value: new THREE.Vector4(tx, tz, coast.n[0], coast.n[1]) }, uCoastP: { value: new THREE.Vector3(A0, DA, NA) }, uCS: { value: tex1 }, uSeaY: { value: ys[2] }, uWindV: { value: windV }, uDesat: { value: 0.35 }, uAmbGain: { value: 1.5 } };
      sprayMeshes.push(addMesh(THREE.Mesh, quadGeometry(A, BB, n), quadMat(su, SPRAY_VS, {}), 9));
      const dp = ptsRand(720);
      sprayMeshes.push(addMesh(THREE.Points, pointGeometry(dp.P, dp.B, 720), pointMat(DROPLET_VS, su, false), 10));
    }
  } else if (biome === 'elysium') {
    const { P, B } = ptsRand(1800);
    const uni = boxUni(60, 20, 60); uni.uWindV = { value: new THREE.Vector2(windV.x * 0.3, windV.y * 0.3) };
    ambient(THREE.Points, pointGeometry(P, B, 1800), pointMat(PHOSPHOR_VS, uni, true), 8, uni.uGY);
  } else if (biome === 'cocytus') {
    { // snow streaks
      const n = 2400, A = new Float32Array(n * 4), B = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { for (let k = 0; k < 4; k++) { A[i * 4 + k] = rngA(); B[i * 4 + k] = rngA(); } }
      const uni = boxUni(72, 5, 72);
      ambient(THREE.Mesh, quadGeometry(A, B, n), quadMat(uni, SNOW_VS, {}), 9, uni.uGY);
    }
    { // spindrift banks
      const n = 150, A = new Float32Array(n * 4), B = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { for (let k = 0; k < 4; k++) { A[i * 4 + k] = rngA(); B[i * 4 + k] = rngA(); } }
      const uni = boxUni(100, 5, 100); uni.uDesat = { value: 0.3 };
      ambient(THREE.Mesh, quadGeometry(A, B, n), quadMat(uni, SPINDRIFT_VS, {}), 9, uni.uGY);
    }
    { // glitter
      const { P, B } = ptsRand(900);
      const uni = boxUni(46, 11, 46);
      ambient(THREE.Points, pointGeometry(P, B, 900), pointMat(GLITTER_VS, uni, true), 10, uni.uGY);
    }
  } else if (biome === 'phlegethon' && river) {
    const ru = riverUniforms();
    { // ash flakes
      const { P, B } = ptsRand(2200);
      const uni = Object.assign(boxUni(64, 26, 64), ru);
      ambient(THREE.Points, pointGeometry(P, B, 2200), pointMat(ASH_VS, uni, false), 8, uni.uGY);
    }
    { // embers
      const { P, B } = ptsRand(560);
      const uni = Object.assign(boxUni(0, 0, 300), ru);
      ambient(THREE.Points, pointGeometry(P, B, 560), pointMat(EMBER_VS, uni, true), 11, null);
    }
    { // smoke plumes
      const plumes = 6, per = 34, n = plumes * per, A = new Float32Array(n * 4), B = new Float32Array(n * 4);
      for (let p = 0; p < plumes; p++) for (let i = 0; i < per; i++) { const o = (p * per + i) * 4; A[o] = p; A[o + 1] = (i + rngA()) / per; A[o + 2] = rngA(); A[o + 3] = plumes; B[o] = rngA(); B[o + 1] = rngA(); B[o + 2] = rngA(); B[o + 3] = rngA(); }
      const uni = Object.assign(boxUni(0, 0, 480), ru);
      ambient(THREE.Mesh, quadGeometry(A, B, n), quadMat(uni, SMOKE_VS, {}), 9, null);
    }
  }

  // ═════════════════════════════ geysers (cocytus) ═════════════════════════════
  const vents = [];
  let gUni = null;
  const gSeed = baseSeed & 0xffff;
  if (biome === 'cocytus' && Array.isArray(site.vents) && site.vents.length) {
    const nv = Math.min(site.vents.length, 12);
    const rng = mulberry(baseSeed ^ 0x6e75);
    for (let i = 0; i < nv; i++) {
      const v = site.vents[i];
      const period = 14 + 24 * rng(), phase = rng() * period;
      vents.push({ i, x: v.x, z: v.z, y: env.groundY ? env.groundY(v.x, v.z) : -4.6, period, phase, level: 0, u: 0, H: 100, D: 5 });
    }
    // showcase: the two vents most in front of the ship start early (first eruption ≈ 9 s and ≈ 15 s after touchdown)
    const front = vents.map((v, k) => ({ k, a: Math.abs(Math.atan2(v.x, -(v.z - 0)) ) })).sort((a, b) => a.a - b.a);
    if (front[0]) vents[front[0].k].phase = vents[front[0].k].period - 9;
    if (front[1] && nv > 2) vents[front[1].k].phase = vents[front[1].k].period - 15;
    // (per-eruption height/duration come from rand01(cycle, vent, gSeed))
    const perV = { col: 200, cap: 90, haze: 34, wisp: 12 };
    const per = perV.col + perV.cap + perV.haze + perV.wisp, n = per * nv;
    const A = new Float32Array(n * 4), B = new Float32Array(n * 4);
    let o = 0;
    for (let v = 0; v < nv; v++) {
      for (const [type, cnt] of [[0, perV.col], [1, perV.cap], [2, perV.haze], [3, perV.wisp]]) for (let i = 0; i < cnt; i++, o++) {
        A[o * 4] = v; A[o * 4 + 1] = (i + rng()) / cnt; A[o * 4 + 2] = rng(); A[o * 4 + 3] = rng();
        B[o * 4] = rng(); B[o * 4 + 1] = rng(); B[o * 4 + 2] = type; B[o * 4 + 3] = rng();
      }
    }
    const uVent = Array.from({ length: nv }, () => new THREE.Vector4()), uVP = Array.from({ length: nv }, () => new THREE.Vector4());
    const wind3 = new THREE.Vector3(wcfg.d[0], wcfg.d[1], wAmt);
    gUni = { uVent: { value: uVent }, uVP: { value: uVP }, uWind3: { value: wind3 }, uGrav: { value: gravity }, uDesat: { value: 0.7 }, uAmbGain: { value: 2.4 } };
    const defs = { NV: String(nv) };
    addMesh(THREE.Mesh, quadGeometry(A, B, n), quadMat(gUni, GEYSER_VS, defs), 14).name = 'fx-geyser-steam';
    { // crystals
      const cn = 110, tot = cn * nv, P = new Float32Array(tot * 3), BB = new Float32Array(tot * 4);
      for (let v = 0; v < nv; v++) for (let i = 0; i < cn; i++) { const q = v * cn + i; P[q * 3] = rng(); P[q * 3 + 1] = rng(); P[q * 3 + 2] = rng(); BB[q * 4] = rng(); BB[q * 4 + 1] = rng(); BB[q * 4 + 2] = rng(); BB[q * 4 + 3] = v; }
      addMesh(THREE.Points, pointGeometry(P, BB, tot), pointMat(CRYSTAL_VS, gUni, true, defs), 15).name = 'fx-geyser-ice';
    }
  }
  function ventState(v, t) {
    const tt = t + v.phase, cyc = Math.floor(tt / v.period), u = tt - cyc * v.period;
    const h1 = rand01(cyc, v.i, gSeed), h2 = rand01(cyc, v.i + 101, gSeed + 17);
    v.H = 50 + 170 * h1; v.D = 4 + 3 * h2; v.u = u;
    const post = u > v.D ? Math.exp(-(u - v.D) / 1.4) : 1;
    v.level = smooth(0, 0.3, u) * post * (0.6 + 0.4 * (v.H - 50) / 170) * (u < v.D + 5 ? 1 : 0);
    v.haze = 0.4 + 1.7 * smooth(0, 0.4, u) * Math.exp(-Math.max(u - v.D, 0) / 4.0) + 0.6 * smooth(v.period - 3.5, v.period, u);
  }
  function geyserLevel(camPos) {
    if (!vents.length || !camPos) return 0;
    let keep = 1;
    for (let i = 0; i < vents.length; i++) {
      const v = vents[i]; if (v.level <= 0.001) continue;
      const dx = camPos.x - v.x, dz = camPos.z - v.z, k = Math.pow(1 + (dx * dx + dz * dz) / 10000, -1.25);   // ≈ 0.29 at 130 m, 0.12 at 215 m, 0.83 at 40 m
      keep *= 1 - clamp(v.level * k * 1.15, 0, 1);
    }
    return clamp(1 - keep, 0, 1);
  }

  // ═════════════════════════════ per-frame ═════════════════════════════
  function update(dt, t, camPos) {
    lastT = t;
    U.uTime.value = t;
    if (camPos) U.uCam.value.set(camPos.x, camPos.y, camPos.z);
    if (env.sunDir) U.uSunDir.value.copy(env.sunDir).normalize();
    refreshLights(dt);
    if (camPos && ambGY.length) {
      gyTimer -= dt;
      if (gyTimer <= 0 && env.groundY) { gyTimer = 0.2; const g = env.groundY(camPos.x, camPos.z); gyCam += (g - gyCam) * (Math.abs(g - gyCam) > 3 ? 1 : 0.5); for (let i = 0; i < ambGY.length; i++) ambGY[i].value = gyCam; }
    }
    for (let i = 0; i < burstSlots.length; i++) { const s = burstSlots[i]; if (s.active && t - s.t0 > BURST_LIFE) { s.active = false; s.mesh.visible = false; } }
    if (riverBake) stepRiverBake(10);
    if (sprayMeshes.length && camPos) { const ld = coast.landDist(camPos.x, camPos.z), vis = ld > -230 && ld < 210; for (let i = 0; i < sprayMeshes.length; i++) sprayMeshes[i].visible = vis; }
    if (gUni) {
      for (let i = 0; i < vents.length; i++) {
        const v = vents[i]; ventState(v, t);
        gUni.uVent.value[i].set(v.x, v.y, v.z, v.u); gUni.uVP.value[i].set(v.H, v.D, v.haze, v.level);
      }
    }
  }

  function dispose() {
    group.parent?.remove(group);
    for (const g of own.geos) g.dispose();
    for (const m of own.mats) m.dispose();
    for (const x of own.textures) x.dispose();
    own.geos.length = own.mats.length = own.textures.length = 0;
    group.clear(); burstSlots.length = 0; vents.length = 0; updaters.length = 0;
  }

  const info = () => {
    let calls = 0, verts = 0;
    for (const o of group.children) {
      if (!o.visible) continue; calls++;
      const g = o.geometry; verts += g.isInstancedBufferGeometry ? g.instanceCount * 4 : g.drawRange.count;
    }
    return { calls, verts };
  };

  return { group, update, burst, geyserLevel, dispose, info, _vents: vents };
}
