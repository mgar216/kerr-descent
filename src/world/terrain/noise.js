// ORPHEUS · surface · noise. JS (double) and GLSL (float) implementations are 1:1 twins so the CPU (floorAt, POI placement)
// and the GPU (vertex displacement, scatter) agree on the heightfield to within ~1e-4 m.
//   hash   : integer avalanche hash (Math.imul / uint wrap — bit-identical)
//   gnoise : 2D gradient (Perlin) noise, 8 gradients of equal length, quintic fade, range ≈ [-1, 1]
//   fbm / ridged : octave sums with per-octave domain rotation and a smooth LOD fade (octaves finer than 2–6 cells vanish)

export function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;

/** uint32 hash of an integer lattice point + seed */
export function hashU(ix, iy, seed) {
  let h = (Math.imul(ix, 0x27d4eb2d) + Math.imul(iy, 0x165667b1) + Math.imul(seed, 0x9e3779b9) + 0x85ebca6b) | 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}
/** uniform random in [0,1) from a lattice point (24 bit, exactly representable in float32) */
export const rand01 = (ix, iy, seed) => (hashU(ix, iy, seed) >>> 8) / 16777216;

const R2 = 1.4142135;
const GX = [1, -1, 1, -1, R2, -R2, 0, 0], GY = [1, 1, -1, -1, 0, 0, R2, -R2];

export function gnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  let k = hashU(ix, iy, seed) & 7; const a = GX[k] * fx + GY[k] * fy;
  k = hashU(ix + 1, iy, seed) & 7; const b = GX[k] * (fx - 1) + GY[k] * fy;
  k = hashU(ix, iy + 1, seed) & 7; const c = GX[k] * fx + GY[k] * (fy - 1);
  k = hashU(ix + 1, iy + 1, seed) & 7; const d = GX[k] * (fx - 1) + GY[k] * (fy - 1);
  const ab = a + (b - a) * ux, cd = c + (d - c) * ux;
  return ab + (cd - ab) * uy;
}

/** fractal sum; p in metres, wl0 = wavelength of the first octave (m), cell = LOD cell size (m). Returns sum of gain^i·noise_i (unnormalised). */
export function fbm(x, y, seed, wl0, oct, gain, cell) {
  let s = 0, a = 1, wl = wl0, qx = x / wl0, qy = y / wl0;
  for (let i = 0; i < 9; i++) {
    if (i >= oct) break;
    const f = ss(2 * cell, 6 * cell, wl);
    if (f <= 0) break;
    s += a * f * gnoise(qx, qy, seed + i);
    const nx = (0.8 * qx - 0.6 * qy) * 2.03, ny = (0.6 * qx + 0.8 * qy) * 2.03; qx = nx; qy = ny;
    a *= gain; wl /= 2.03;
  }
  return s;
}
/** ridged multifractal-ish: Σ gain^i·(1-|n|)² — ≈ [0, 1.9] */
export function ridged(x, y, seed, wl0, oct, gain, cell) {
  let s = 0, a = 1, wl = wl0, qx = x / wl0, qy = y / wl0;
  for (let i = 0; i < 9; i++) {
    if (i >= oct) break;
    const f = ss(2 * cell, 6 * cell, wl);
    if (f <= 0) break;
    let n = 1 - Math.abs(gnoise(qx, qy, seed + i)); n *= n;
    s += a * f * n;
    const nx = (0.8 * qx - 0.6 * qy) * 2.03, ny = (0.6 * qx + 0.8 * qy) * 2.03; qx = nx; qy = ny;
    a *= gain; wl /= 2.03;
  }
  return s;
}

/** GLSL twin. Inject once per shader (vertex and/or fragment). Needs `precision highp float/int` (three default). */
export const GLSL_NOISE = /* glsl */ `
uint sfH(ivec2 p, uint seed){
  uint h = uint(p.x) * 0x27d4eb2du + uint(p.y) * 0x165667b1u + seed * 0x9e3779b9u + 0x85ebca6bu;
  h ^= h >> 15u; h *= 0x2c1b3c6du;
  h ^= h >> 12u; h *= 0x297a2d39u;
  h ^= h >> 15u;
  return h;
}
float sfR(ivec2 p, uint seed){ return float(sfH(p, seed) >> 8u) * (1.0 / 16777216.0); }
const vec2 SF_G[8] = vec2[8](vec2(1.0,1.0), vec2(-1.0,1.0), vec2(1.0,-1.0), vec2(-1.0,-1.0), vec2(1.4142135,0.0), vec2(-1.4142135,0.0), vec2(0.0,1.4142135), vec2(0.0,-1.4142135));
float sfNoise(vec2 p, uint seed){
  vec2 i = floor(p); vec2 f = p - i; ivec2 ii = ivec2(i);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a = dot(SF_G[sfH(ii, seed) & 7u], f);
  float b = dot(SF_G[sfH(ii + ivec2(1,0), seed) & 7u], f - vec2(1.0,0.0));
  float c = dot(SF_G[sfH(ii + ivec2(0,1), seed) & 7u], f - vec2(0.0,1.0));
  float d = dot(SF_G[sfH(ii + ivec2(1,1), seed) & 7u], f - vec2(1.0,1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float sfFbm(vec2 p, uint seed, float wl0, int oct, float gain, float cell){
  float s = 0.0, a = 1.0, wl = wl0; vec2 q = p / wl0;
  for (int i = 0; i < 9; i++){
    if (i >= oct) break;
    float f = smoothstep(2.0 * cell, 6.0 * cell, wl);
    if (f <= 0.0) break;
    s += a * f * sfNoise(q, seed + uint(i));
    q = vec2(0.8 * q.x - 0.6 * q.y, 0.6 * q.x + 0.8 * q.y) * 2.03;
    a *= gain; wl /= 2.03;
  }
  return s;
}
float sfRidged(vec2 p, uint seed, float wl0, int oct, float gain, float cell){
  float s = 0.0, a = 1.0, wl = wl0; vec2 q = p / wl0;
  for (int i = 0; i < 9; i++){
    if (i >= oct) break;
    float f = smoothstep(2.0 * cell, 6.0 * cell, wl);
    if (f <= 0.0) break;
    float n = 1.0 - abs(sfNoise(q, seed + uint(i))); n *= n;
    s += a * f * n;
    q = vec2(0.8 * q.x - 0.6 * q.y, 0.6 * q.x + 0.8 * q.y) * 2.03;
    a *= gain; wl /= 2.03;
  }
  return s;
}
// ── visual-only helpers (fragment/scatter): 3D value noise with analytic derivatives (iq) ──
float sfH3(ivec3 p, uint seed){
  uint h = uint(p.x) * 0x27d4eb2du + uint(p.y) * 0x165667b1u + uint(p.z) * 0xd3a2646cu + seed * 0x9e3779b9u + 0x85ebca6bu;
  h ^= h >> 15u; h *= 0x2c1b3c6du; h ^= h >> 12u; h *= 0x297a2d39u; h ^= h >> 15u;
  return float(h >> 8u) * (1.0 / 16777216.0);
}
vec4 sfVN3(vec3 x, uint seed){            // (value 0..1, d/dx, d/dy, d/dz)
  vec3 fl = floor(x); vec3 f = x - fl; ivec3 i = ivec3(fl);
  vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  vec3 du = 30.0*f*f*(f*(f-2.0)+1.0);
  float a = sfH3(i, seed), b = sfH3(i + ivec3(1,0,0), seed), c = sfH3(i + ivec3(0,1,0), seed), d = sfH3(i + ivec3(1,1,0), seed);
  float e = sfH3(i + ivec3(0,0,1), seed), f1 = sfH3(i + ivec3(1,0,1), seed), g = sfH3(i + ivec3(0,1,1), seed), h = sfH3(i + ivec3(1,1,1), seed);
  float k0 = a, k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d, k5 = a - c - e + g, k6 = a - b - e + f1, k7 = -a + b + c - d + e - f1 - g + h;
  return vec4(k0 + k1*u.x + k2*u.y + k3*u.z + k4*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z,
              du.x * (k1 + k4*u.y + k6*u.z + k7*u.y*u.z),
              du.y * (k2 + k5*u.z + k4*u.x + k7*u.z*u.x),
              du.z * (k3 + k6*u.x + k5*u.y + k7*u.x*u.y));
}
float sfVN2(vec2 p, uint seed){           // cheap 2D value noise 0..1
  vec2 i = floor(p); vec2 f = p - i; ivec2 ii = ivec2(i);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(sfR(ii, seed), sfR(ii + ivec2(1,0), seed), u.x), mix(sfR(ii + ivec2(0,1), seed), sfR(ii + ivec2(1,1), seed), u.x), u.y);
}
`;
