// ORPHEUS · surface · biome heightfields.
// Every biome has a JS function and a GLSL twin (same maths, same seeds, same constants). The GLSL lives in GLSL_HEIGHT[biome]
// and defines `float sfHeightRaw(vec2 p, float cell)`; `sfHeight` (below) subtracts the pad-centre height and blends the flat pads.
//
// Param layout (uP[0..7] vec4 ↔ P[0..31] floats):
//  asphodel  : uP0=(hillAmp,hillWave,seaOn,cliffH) uP1=(coastNx,coastNz,coastD,coastWob) uP2=(wobWave,islandAmp,islandWave,cliffWave)
//  phlegethon: uP0=(flowAmp,flowWave,ridgeAmp,coneAmp) uP1=(riverX0,a1,l1,p1) uP2=(a2,l2,p2,wLava) uP3=(chan,carve,fissure,0) uP4=(ridgeNx,ridgeNz,ridgeDist,ridgeWidth)
//  charon    : uP0=(hillAmp,hillWave,craterDensity,0) uP1=(bigCx,bigCz,bigR,bigDepth) uP2=(bigRim,0,0,0)
//  cocytus   : uP0=(plainAmp,plainWave,crevAmp,crevWave) uP1=(lakeCx,lakeCz,lakeR,lakeEdge) uP2=(drift,0,0,0) + vents uV[i]=(x,z,R,H), uVN
//  elysium   : uP0=(duneAmp,duneWave,crystalDensity,0)
import { clamp, ss, mix, fbm, ridged, gnoise, rand01, GLSL_NOISE } from './noise.js';

const DEG = Math.PI / 180, TAU = Math.PI * 2;
export const BIOME_ID = { asphodel: 1, phlegethon: 2, charon: 3, cocytus: 4, elysium: 5 };

// ───────────────────────────── parameter packing ─────────────────────────────
export function packParams(biome, site) {
  const T = site.terrain, P = new Float32Array(32), V = new Float32Array(32);
  let vn = 0;
  switch (biome) {
    case 'asphodel': {
      P.set([T.hillAmp, T.hillWave, T.seaOn ? 1 : 0, T.cliffH], 0);
      const c = T.coast, b = c ? c.bearing * DEG : 0;
      P.set([c ? Math.sin(b) : 0, c ? -Math.cos(b) : 0, c ? c.d : 0, c ? c.wob : 0], 4);
      P.set([c ? c.wobWave : 100, T.islandAmp || 0, T.islandWave || 900, T.cliffWave], 8);
      break;
    }
    case 'phlegethon': {
      const r = T.river, rb = (T.ridgeBearing || 0) * DEG;
      P.set([T.flowAmp, T.flowWave, T.ridgeAmp, T.coneAmp], 0);
      P.set([r.x0, r.a1, r.l1, r.p1], 4); P.set([r.a2, r.l2, r.p2, r.wLava], 8); P.set([r.chan, r.carve, T.fissure, 0], 12);
      P.set([Math.sin(rb), -Math.cos(rb), T.ridgeDist, T.ridgeWidth || 150], 16);
      break;
    }
    case 'charon': {
      P.set([T.hillAmp, T.hillWave, T.craterDensity, 0], 0);
      const g = T.big; if (g) P.set([g.cx, g.cz, g.R, g.depth], 4), P.set([g.rim, 0, 0, 0], 8);
      break;
    }
    case 'cocytus': {
      P.set([T.plainAmp, T.plainWave, T.crevAmp, T.crevWave], 0);
      const l = T.lake; if (l) P.set([l.cx, l.cz, l.R, l.edge], 4);
      P.set([T.drift, 0, 0, 0], 8);
      for (const v of (site.vents || [])) { if (vn >= 8) break; V.set([v.x, v.z, 34 + (vn % 3) * 10, 3.2 + (vn % 2) * 1.2], vn * 4); vn++; }
      break;
    }
    case 'elysium': P.set([T.duneAmp, T.duneWave, T.crystalDensity, 0], 0); break;
  }
  return { P, V, vn };
}

// ───────────────────────────── JS heightfields ─────────────────────────────
function riverDistJS(P, x, z) {
  const a = TAU * z / P[6] + P[7], b = TAU * z / P[9] + P[10];
  const cx = P[4] + P[5] * Math.sin(a) + P[8] * Math.sin(b);
  const dc = P[5] * TAU / P[6] * Math.cos(a) + P[8] * TAU / P[9] * Math.cos(b);
  return (x - cx) / Math.sqrt(1 + dc * dc);
}
function conesJS(x, z, seed, cell) {
  const C = 620; let s = 0;
  const cx = Math.floor(x / C), cz = Math.floor(z / C);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const ix = cx + i, iz = cz + j;
    if (rand01(ix, iz, seed + 71) < 0.45) continue;
    const jx = (ix + 0.2 + 0.6 * rand01(ix, iz, seed + 73)) * C, jz = (iz + 0.2 + 0.6 * rand01(ix, iz, seed + 79)) * C;
    const r = 70 + 90 * rand01(ix, iz, seed + 83), Hc = 0.38 * r;
    const q = Math.hypot(x - jx, z - jz) / r;
    if (q >= 1) continue;
    s += ss(1.5 * cell, 4 * cell, r) * Hc * (Math.pow(1 - q, 1.25) - 0.28 * (1 - ss(0, 0.30, q)));
  }
  return s;
}
function cratersJS(x, z, seed, scaleR, prob, cell) {
  const C = scaleR * 3.2; const cx = Math.floor(x / C), cz = Math.floor(z / C); let s = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const ix = cx + i, iz = cz + j;
    if (rand01(ix, iz, seed) > prob) continue;
    const px = (ix + 0.25 + 0.5 * rand01(ix, iz, seed + 1)) * C, pz = (iz + 0.25 + 0.5 * rand01(ix, iz, seed + 2)) * C;
    const r = scaleR * (0.45 + 0.55 * rand01(ix, iz, seed + 3));
    const q = Math.hypot(x - px, z - pz) / r;
    if (q > 2.2) continue;
    const D = r * (0.10 + 0.07 * rand01(ix, iz, seed + 4)), Rm = D * 0.38;
    const bowl = q < 1 ? -D * (1 - q * q) : 0;
    const rim = Rm * Math.exp(-Math.pow((q - 1) / 0.22, 2));
    const eject = q > 1 ? 0.25 * Rm * Math.exp(-(q - 1) / 0.9) * ss(1, 1.12, q) : 0;
    s += ss(1.2 * cell, 3.5 * cell, r) * (bowl + rim + eject);
  }
  return s;
}

const RAW = {
  asphodel(P, V, vn, sd, x, z, cell) {
    let h = P[0] * fbm(x, z, sd, P[1], 6, 0.52, cell);
    h += 0.18 * fbm(x + 31.7, z + 31.7, sd + 7, 9.0, 3, 0.5, cell);
    const n1 = fbm(x, z, sd + 13, P[11], 3, 0.5, cell), m2 = fbm(x, z, sd + 17, P[11] * 2.3, 2, 0.5, cell);
    h += P[3] * ss(-0.02, 0.02, n1) * ss(-0.1, 0.35, m2);
    if (P[2] > 0.5) {
      const nx = P[4], nz = P[5], along = x * -nz + z * nx;
      const wob = P[7] * (gnoise(along / P[8], 3.7, sd) + 0.4 * gnoise(along / (P[8] * 0.37), 9.1, sd + 3));
      const land = P[6] + wob - (x * nx + z * nz);
      const e = land >= 0 ? 2.6 * (1 - Math.exp(-land / 28)) : -9 * (1 - Math.exp(land / 140));
      const inland = ss(18, 170, land);
      let isl = 0;
      if (land < -80) { const inoise = fbm(x, z, sd + 23, P[10], 4, 0.5, cell); isl = P[9] * ss(0.30, 0.62, inoise) * (1 - ss(-260, -80, land)); }
      h = e + h * inland + isl;
    }
    return h;
  },
  phlegethon(P, V, vn, sd, x, z, cell) {
    let h = P[0] * fbm(x, z, sd, P[1], 5, 0.5, cell);
    h += 1.44 * (ridged(x, z, sd + 5, 70, 4, 0.5, cell) - 0.55);
    h += 0.35 * fbm(x, z, sd + 9, 6.5, 3, 0.55, cell);
    const rd = x * P[16] + z * P[17] - P[18], rw = P[19];
    h += P[2] * Math.exp(-(rd * rd) / (rw * rw)) * clamp(0.65 + 0.55 * fbm(x, z, sd + 11, 260, 4, 0.5, cell), 0.2, 1.4);
    h += P[3] * conesJS(x, z, sd, cell);
    const wl = P[11], wc = wl * P[12], ad = Math.abs(riverDistJS(P, x, z));
    h -= P[13] * (1 - ss(wl * 0.55, wc, ad));
    h += 0.9 * Math.exp(-Math.pow((ad - wc * 1.08) / (wc * 0.45), 2));
    return h;
  },
  charon(P, V, vn, sd, x, z, cell) {
    let h = P[0] * fbm(x, z, sd, P[1], 5, 0.5, cell);
    h += 0.10 * fbm(x, z, sd + 3, 5.0, 3, 0.55, cell);
    const d = P[2], plain = ss(50, 230, Math.hypot(x - P[30], z - P[31]));
    h += plain * (cratersJS(x, z, sd + 101, 26, d * 0.55, cell) + cratersJS(x, z, sd + 211, 80, d * 0.45, cell) + cratersJS(x, z, sd + 307, 250, d * 0.40, cell) + cratersJS(x, z, sd + 401, 780, d * 0.35, cell));
    if (P[6] > 1) {
      const q = Math.hypot(x - P[4], z - P[5]) / P[6], wall = ss(0.55, 1.0, q);
      h += -P[7] * (1 - wall) + P[8] * Math.exp(-Math.pow((q - 1) / 0.12, 2)) + (q > 1 ? P[8] * 0.4 * Math.exp(-(q - 1) / 0.5) * ss(1, 1.1, q) : 0) + P[7] * 0.35 * Math.exp(-Math.pow(q / 0.12, 2));
    }
    return h;
  },
  cocytus(P, V, vn, sd, x, z, cell) {
    let h = P[0] * fbm(x, z, sd, P[1], 5, 0.5, cell);
    h += P[8] * 0.9 * (ridged(x * 0.35 + z * 0.1, z, sd + 5, 22, 3, 0.5, cell) - 0.5);
    h += 0.12 * fbm(x, z, sd + 9, 4, 2, 0.5, cell);
    let lake = 0;
    if (P[6] > 1) {
      const d = Math.hypot(x - P[4], z - P[5]);
      lake = 1 - ss(P[6] - P[7], P[6], d);
      h = mix(h, 0, lake * 0.96);
      h += 0.35 * lake * (ridged(x, z, sd + 23, 40, 3, 0.5, cell) - 0.55);
    }
    const cn = fbm(x, z, sd + 13, P[3], 3, 0.5, cell), cmask = ss(-0.05, 0.3, fbm(x, z, sd + 19, P[3] * 3, 2, 0.5, cell));
    h -= P[2] * (1 - ss(0, 0.04, Math.abs(cn))) * cmask * (1 - ss(1.0, 3.0, cell)) * (1 - lake * 0.85);
    for (let i = 0; i < vn; i++) {
      const q = Math.hypot(x - V[i * 4], z - V[i * 4 + 1]) / V[i * 4 + 2];
      if (q < 1) h += V[i * 4 + 3] * (Math.pow(1 - q, 1.6) - 0.35 * (1 - ss(0, 0.14, q)));
    }
    return h;
  },
  elysium(P, V, vn, sd, x, z, cell) {
    let h = P[0] * fbm(x, z, sd, P[1], 5, 0.5, cell);
    const t = h / 1.4, fl = Math.floor(t), f = t - fl;
    h = mix(h, (fl + ss(0.55, 0.95, f)) * 1.4, 0.55);
    h += 0.6 * (ridged(x, z, sd + 5, 24, 3, 0.5, cell) - 0.5);
    h += 0.16 * fbm(x, z, sd + 9, 5, 2, 0.5, cell);
    return h;
  },
};

// ───────────────────────────── GLSL twins ─────────────────────────────
const GLSL_COMMON_UNIFORMS = /* glsl */ `
uniform vec4 uP[8]; uniform vec4 uV[8]; uniform int uVN;
uniform vec4 uPadA[8]; uniform float uPadY[8]; uniform int uPadN;
uniform float uH0; uniform uint uSeed;
`;
const GLSL_HEIGHT_TAIL = /* glsl */ `
float sfHeight(vec2 p, float cell){
  float h = sfHeightRaw(p, cell) - uH0;
  for (int i = 0; i < 8; i++){
    if (i >= uPadN) break;
    float w = 1.0 - smoothstep(uPadA[i].z, uPadA[i].w, length(p - uPadA[i].xy));
    h = mix(h, uPadY[i], w);
  }
  return h;
}
`;
const GLSL_RIVER = /* glsl */ `
float sfRiverDist(vec2 p){
  const float TAU = 6.283185307179586;
  float a = TAU * p.y / uP[1].z + uP[1].w, b = TAU * p.y / uP[2].y + uP[2].z;
  float cx = uP[1].x + uP[1].y * sin(a) + uP[2].x * sin(b);
  float dc = uP[1].y * TAU / uP[1].z * cos(a) + uP[2].x * TAU / uP[2].y * cos(b);
  return (p.x - cx) / sqrt(1.0 + dc * dc);
}
`;

export const GLSL_HEIGHT = {
  asphodel: /* glsl */ `
float sfHeightRaw(vec2 p, float cell){
  uint sd = uSeed;
  float h = uP[0].x * sfFbm(p, sd, uP[0].y, 6, 0.52, cell);
  h += 0.18 * sfFbm(p + 31.7, sd + 7u, 9.0, 3, 0.5, cell);
  float n1 = sfFbm(p, sd + 13u, uP[2].w, 3, 0.5, cell), m2 = sfFbm(p, sd + 17u, uP[2].w * 2.3, 2, 0.5, cell);
  h += uP[0].w * smoothstep(-0.02, 0.02, n1) * smoothstep(-0.1, 0.35, m2);
  if (uP[0].z > 0.5) {
    vec2 n = uP[1].xy; float along = dot(p, vec2(-n.y, n.x));
    float wob = uP[1].w * (sfNoise(vec2(along / uP[2].x, 3.7), sd) + 0.4 * sfNoise(vec2(along / (uP[2].x * 0.37), 9.1), sd + 3u));
    float land = uP[1].z + wob - dot(p, n);
    float e = land >= 0.0 ? 2.6 * (1.0 - exp(-land / 28.0)) : -9.0 * (1.0 - exp(land / 140.0));
    float inland = smoothstep(18.0, 170.0, land);
    float isl = 0.0;
    if (land < -80.0) { float inoise = sfFbm(p, sd + 23u, uP[2].z, 4, 0.5, cell); isl = uP[2].y * smoothstep(0.30, 0.62, inoise) * (1.0 - smoothstep(-260.0, -80.0, land)); }
    h = e + h * inland + isl;
  }
  return h;
}`,
  phlegethon: GLSL_RIVER + /* glsl */ `
float sfCones(vec2 p, uint sd, float cell){
  const float C = 620.0; float s = 0.0; ivec2 c0 = ivec2(floor(p / C));
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    ivec2 id = c0 + ivec2(i, j);
    if (sfR(id, sd + 71u) < 0.45) continue;
    vec2 jc = (vec2(id) + vec2(0.2 + 0.6 * sfR(id, sd + 73u), 0.2 + 0.6 * sfR(id, sd + 79u))) * C;
    float r = 70.0 + 90.0 * sfR(id, sd + 83u), Hc = 0.38 * r;
    float q = length(p - jc) / r;
    if (q >= 1.0) continue;
    s += smoothstep(1.5 * cell, 4.0 * cell, r) * Hc * (pow(1.0 - q, 1.25) - 0.28 * (1.0 - smoothstep(0.0, 0.30, q)));
  }
  return s;
}
float sfHeightRaw(vec2 p, float cell){
  uint sd = uSeed;
  float h = uP[0].x * sfFbm(p, sd, uP[0].y, 5, 0.5, cell);
  h += 1.44 * (sfRidged(p, sd + 5u, 70.0, 4, 0.5, cell) - 0.55);
  h += 0.35 * sfFbm(p, sd + 9u, 6.5, 3, 0.55, cell);
  float rd = dot(p, uP[4].xy) - uP[4].z, rw = uP[4].w;
  h += uP[0].z * exp(-(rd * rd) / (rw * rw)) * clamp(0.65 + 0.55 * sfFbm(p, sd + 11u, 260.0, 4, 0.5, cell), 0.2, 1.4);
  h += uP[0].w * sfCones(p, sd, cell);
  float wl = uP[2].w, wc = wl * uP[3].x, ad = abs(sfRiverDist(p));
  h -= uP[3].y * (1.0 - smoothstep(wl * 0.55, wc, ad));
  float lv = (ad - wc * 1.08) / (wc * 0.45);
  h += 0.9 * exp(-lv * lv);
  return h;
}`,
  charon: /* glsl */ `
float sfCraters(vec2 p, uint sd, float scaleR, float prob, float cell){
  float C = scaleR * 3.2; float s = 0.0; ivec2 c0 = ivec2(floor(p / C));
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    ivec2 id = c0 + ivec2(i, j);
    if (sfR(id, sd) > prob) continue;
    vec2 pc = (vec2(id) + vec2(0.25 + 0.5 * sfR(id, sd + 1u), 0.25 + 0.5 * sfR(id, sd + 2u))) * C;
    float r = scaleR * (0.45 + 0.55 * sfR(id, sd + 3u));
    float q = length(p - pc) / r;
    if (q > 2.2) continue;
    float D = r * (0.10 + 0.07 * sfR(id, sd + 4u)), Rm = D * 0.38;
    float bowl = q < 1.0 ? -D * (1.0 - q * q) : 0.0;
    float rl = (q - 1.0) / 0.22;
    float rim = Rm * exp(-rl * rl);
    float ej = q > 1.0 ? 0.25 * Rm * exp(-(q - 1.0) / 0.9) * smoothstep(1.0, 1.12, q) : 0.0;
    s += smoothstep(1.2 * cell, 3.5 * cell, r) * (bowl + rim + ej);
  }
  return s;
}
float sfHeightRaw(vec2 p, float cell){
  uint sd = uSeed;
  float h = uP[0].x * sfFbm(p, sd, uP[0].y, 5, 0.5, cell);
  h += 0.10 * sfFbm(p, sd + 3u, 5.0, 3, 0.55, cell);
  float d = uP[0].z, plain = smoothstep(50.0, 230.0, length(p - uP[7].zw));
  h += plain * (sfCraters(p, sd + 101u, 26.0, d * 0.55, cell) + sfCraters(p, sd + 211u, 80.0, d * 0.45, cell) + sfCraters(p, sd + 307u, 250.0, d * 0.40, cell) + sfCraters(p, sd + 401u, 780.0, d * 0.35, cell));
  if (uP[1].z > 1.0) {
    float q = length(p - uP[1].xy) / uP[1].z, wall = smoothstep(0.55, 1.0, q);
    float rl = (q - 1.0) / 0.12, pk = q / 0.12;
    h += -uP[1].w * (1.0 - wall) + uP[2].x * exp(-rl * rl) + (q > 1.0 ? uP[2].x * 0.4 * exp(-(q - 1.0) / 0.5) * smoothstep(1.0, 1.1, q) : 0.0) + uP[1].w * 0.35 * exp(-pk * pk);
  }
  return h;
}`,
  cocytus: /* glsl */ `
float sfHeightRaw(vec2 p, float cell){
  uint sd = uSeed;
  float h = uP[0].x * sfFbm(p, sd, uP[0].y, 5, 0.5, cell);
  h += uP[2].x * 0.9 * (sfRidged(vec2(p.x * 0.35 + p.y * 0.1, p.y), sd + 5u, 22.0, 3, 0.5, cell) - 0.5);
  h += 0.12 * sfFbm(p, sd + 9u, 4.0, 2, 0.5, cell);
  float lake = 0.0;
  if (uP[1].z > 1.0) {
    float d = length(p - uP[1].xy);
    lake = 1.0 - smoothstep(uP[1].z - uP[1].w, uP[1].z, d);
    h = mix(h, 0.0, lake * 0.96);
    h += 0.35 * lake * (sfRidged(p, sd + 23u, 40.0, 3, 0.5, cell) - 0.55);
  }
  float cn = sfFbm(p, sd + 13u, uP[0].w, 3, 0.5, cell), cmask = smoothstep(-0.05, 0.3, sfFbm(p, sd + 19u, uP[0].w * 3.0, 2, 0.5, cell));
  h -= uP[0].z * (1.0 - smoothstep(0.0, 0.04, abs(cn))) * cmask * (1.0 - smoothstep(1.0, 3.0, cell)) * (1.0 - lake * 0.85);
  for (int i = 0; i < 8; i++){
    if (i >= uVN) break;
    float q = length(p - uV[i].xy) / uV[i].z;
    if (q < 1.0) h += uV[i].w * (pow(1.0 - q, 1.6) - 0.35 * (1.0 - smoothstep(0.0, 0.14, q)));
  }
  return h;
}`,
  elysium: /* glsl */ `
float sfHeightRaw(vec2 p, float cell){
  uint sd = uSeed;
  float h = uP[0].x * sfFbm(p, sd, uP[0].y, 5, 0.5, cell);
  float t = h / 1.4, fl = floor(t), f = t - fl;
  h = mix(h, (fl + smoothstep(0.55, 0.95, f)) * 1.4, 0.55);
  h += 0.6 * (sfRidged(p, sd + 5u, 24.0, 3, 0.5, cell) - 0.5);
  h += 0.16 * sfFbm(p, sd + 9u, 5.0, 2, 0.5, cell);
  return h;
}`,
};

/** complete GLSL height module for a biome (noise + uniforms + sfHeightRaw + sfHeight) */
export function glslHeightModule(biome) { return GLSL_NOISE + GLSL_COMMON_UNIFORMS + GLSL_HEIGHT[biome] + GLSL_HEIGHT_TAIL; }
export const GLSL_RIVER_FN = GLSL_RIVER;

// ───────────────────────────── Heightfield (CPU side) ─────────────────────────────
export class Heightfield {
  /**
   * @param biome  'asphodel'…
   * @param site   SITES def
   * @param o      { groundY0, radiusM, padCenter:[x,z], padR0, padR1, seedOffset }
   */
  constructor(biome, site, o) {
    this.biome = biome; this.site = site;
    this.seed = (site.seed | 0) + (o.seedOffset | 0);
    const { P, V, vn } = packParams(biome, site);
    P[30] = o.padCenter[0]; P[31] = o.padCenter[1];
    this.P = P; this.V = V; this.vn = vn;
    this.groundY0 = o.groundY0; this.radiusM = o.radiusM;
    this.curvK = 1 / (2 * o.radiusM);
    this.curvC = o.padCenter.slice();
    this.raw = RAW[biome];
    this.h0 = this.raw(P, V, vn, this.seed, o.padCenter[0], o.padCenter[1], 0.5);
    // pads: [0] ship pad (target 0), then slots with padR > 0
    this.pads = [{ x: o.padCenter[0], z: o.padCenter[1], r0: o.padR0, r1: o.padR1, y: 0 }];
    for (const s of Object.values(site.slots)) {
      if (s.padR > 0 && this.pads.length < 8) this.pads.push({ x: s.x, z: s.z, r0: s.padR, r1: s.padR * 1.9, y: this.raw(P, V, vn, this.seed, s.x, s.z, 0.5) - this.h0 });
    }
  }
  /** terrain height (m) relative to the ship pad level, at LOD cell size `cell` (default = finest). */
  height(x, z, cell = 0.5) {
    let h = this.raw(this.P, this.V, this.vn, this.seed, x, z, cell) - this.h0;
    for (const p of this.pads) { const w = 1 - ss(p.r0, p.r1, Math.hypot(x - p.x, z - p.z)); h = h + (p.y - h) * w; }
    return h;
  }
  /** planet curvature drop (m) at (x,z) relative to the pad centre */
  curvDrop(x, z) { const dx = x - this.curvC[0], dz = z - this.curvC[1]; return this.curvK * (dx * dx + dz * dz); }
  /** ship-space terrain surface y */
  groundY(x, z) { return this.groundY0 + this.height(x, z) - this.curvDrop(x, z); }
  groundNormal(x, z, out) {
    const e = 0.5, hx = this.groundY(x + e, z) - this.groundY(x - e, z), hz = this.groundY(x, z + e) - this.groundY(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz) || 1;
    out.set(-hx / l, 2 * e / l, -hz / l); return out;
  }
  /** shader uniform values */
  uniformValues() {
    const padA = [], padY = [];
    for (let i = 0; i < 8; i++) { const p = this.pads[i]; padA.push(p ? [p.x, p.z, p.r0, p.r1] : [0, 0, 1, 2]); padY.push(p ? p.y : 0); }
    return { P: this.P, V: this.V, vn: this.vn, padA, padY, padN: this.pads.length, h0: this.h0, seed: this.seed >>> 0 };
  }
}

// ───────────────────────────── feature helpers (given to POI builders / FX) ─────────────────────────────
export function makeFeatures(biome, site, hf) {
  const T = site.terrain, f = {};
  if (biome === 'phlegethon') f.river = T.river;
  if (biome === 'asphodel' && T.coast) {
    const P = hf.P, sd = hf.seed, n = [P[4], P[5]];
    f.coast = {
      n,
      /** metres inland from the shoreline (negative = in the sea) */
      landDist(x, z) {
        const along = x * -n[1] + z * n[0];
        const wob = P[7] * (gnoise(along / P[8], 3.7, sd) + 0.4 * gnoise(along / (P[8] * 0.37), 9.1, sd + 3));
        return P[6] + wob - (x * n[0] + z * n[1]);
      },
    };
  }
  if (biome === 'cocytus' && T.lake) {
    const l = T.lake; f.lake = { ...l, /** metres inside the lake edge (negative = on land) */ inside: (x, z) => l.R - Math.hypot(x - l.cx, z - l.cz) };
  }
  if (biome === 'charon' && T.big) f.crater = { ...T.big };
  return f;
}
