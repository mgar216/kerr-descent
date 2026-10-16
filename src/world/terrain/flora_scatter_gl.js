// ORPHEUS · surface · scatter GLSL.
//   · bakeFrag(biome)   placement bake: one texel pair (A = x, shipY, z, size · B = colour/params, seed24) per slot of a toroidal window
//   · instanceVS(kind)  instance vertex programs (inject at begin_vertex / beginnormal_vertex of MeshStandardMaterial & MeshDepthMaterial)
//   · FS_ROCK/FS_GEM    fragment injections (detail bump, snow caps, lava rim / glassy emissive gradient, fake translucency)
// All per-instance randomness is derived from the 24-bit `seed` stored in texel B via sfR(ivec2(seed, k), salt) — the JS twin in
// flora_scatter.js (crystal collisions) evaluates exactly the same functions.
import { GLSL_NOISE } from './noise.js';
import { GLSL_BAKED } from './terrain.js';
import { GLSL_RIVER_FN } from './biomes.js';

export const PLACE_VERT = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// ───────────────────────────── placement bake ─────────────────────────────
const BAKE_HEAD = /* glsl */ `
precision highp float; precision highp int;
${GLSL_NOISE}
${GLSL_BAKED}
uniform vec4 uP[8]; uniform vec4 uV[8]; uniform int uVN;
uniform vec2 uCamCell; uniform float uW; uniform float uCellS; uniform uint uSeed; uniform uint uLSeed;
uniform float uK; uniform float uGroundY; uniform vec2 uCurvC;
uniform vec4 uPadA[8]; uniform int uPadN;
uniform float uHalfR; uniform vec2 uInner;
@RIVER@
uniform float uDensity; uniform vec2 uSize; uniform float uSizePow; uniform float uRule; uniform float uPadKeep; uniform vec4 uXP;
float sfPadK(vec2 p, float keepIn){
  float k = smoothstep(uPadA[0].z * 0.96, uPadA[0].z * 1.30, length(p - uPadA[0].xy));
  for (int i = 1; i < 8; i++){ if (i >= uPadN) break; k *= mix(keepIn, 1.0, smoothstep(uPadA[i].z * 0.85, uPadA[i].z * 1.25 + 1.0, length(p - uPadA[i].xy))); }
  return k;
}
void main(){
  vec2 px = floor(gl_FragCoord.xy);
  float isB = mod(px.x, 2.0);
  vec2 slot = vec2(floor(px.x * 0.5), px.y);
  vec2 cell = slot + uW * floor((uCamCell + uW * 0.5 - slot) / uW);
  ivec2 ic = ivec2(cell);
  uint sd = uSeed + uLSeed;
  float r0 = sfR(ic, sd + 1u), r1 = sfR(ic, sd + 2u), r2 = sfR(ic, sd + 3u), r3 = sfR(ic, sd + 4u), r4 = sfR(ic, sd + 5u), r5 = sfR(ic, sd + 6u);
  vec2 gP = (cell + vec2(r0, r1)) * uCellS;
  vec2 camP = (uCamCell + 0.5) * uCellS;
  float gD = length(gP - camP);
  float size = uSize.x + (uSize.y - uSize.x) * pow(r3, uSizePow);
  float eps = clamp(size * 0.45, 0.45, 4.0);
  float gH = sfBakedH(gP);
  float gHx = sfBakedH(gP + vec2(eps, 0.0)), gHz = sfBakedH(gP + vec2(0.0, eps));
  float slope = 1.0 - normalize(vec3(gH - gHx, eps, gH - gHz)).y;
  float relief = clamp(max(abs(gH - gHx), abs(gH - gHz)), 0.0, size * 0.6);
  float padK = sfPadK(gP, uPadKeep);
  float dens = 0.0; vec3 col = vec3(0.5);
`;

const BAKE_TAIL = /* glsl */ `
  float fade = (1.0 - smoothstep(uHalfR * 0.58, uHalfR * 0.93, gD)) * smoothstep(uInner.x, uInner.y, gD);
  float keep = step(r2, dens) * fade;
  float curv = uK * dot(gP - uCurvC, gP - uCurvC);
  if (isB < 0.5) gl_FragColor = vec4(gP.x, uGroundY + gH - 0.5 * relief - curv, gP.y, size * keep);
  else gl_FragColor = vec4(col, float(sfH(ic, sd + 7u) >> 8u));
}`;

const RULES = {
  // black basalt, oxide tints, cinder gravel, columnar outcrops; never on the lava channel
  phlegethon: /* glsl */ `
  float rdist = abs(sfRiverDist(gP));
  float wc = uP[2].w * uP[3].x;
  float lavaOK = smoothstep(wc + 3.0, wc + 7.5, rdist);
  float m1 = sfVN2(gP * 0.02, uSeed + 3u), m2 = sfVN2(gP * 0.11, uSeed + 5u), m3 = sfVN2(gP * 0.6, uSeed + 7u);
  vec3 basalt = mix(vec3(0.015, 0.014, 0.016), vec3(0.052, 0.049, 0.051), m3 * 0.55 + r4 * 0.45);
  basalt = mix(basalt, vec3(0.092, 0.040, 0.026), smoothstep(0.62, 0.86, m1) * 0.55 * (0.3 + 0.7 * r5));
  float ashM = smoothstep(0.50, 0.78, m2 * 0.7 + m1 * 0.5) * smoothstep(0.45, 0.12, slope);
  float clump = smoothstep(0.28, 0.78, sfVN2(gP * 0.026 + 11.0, uSeed + 301u));
  float rubble = exp(-pow((rdist - wc * 1.12) / 12.0, 2.0));
  float slopeB = 0.6 + 2.0 * smoothstep(0.02, 0.28, slope);
  if (uRule < 0.5) {            // boulders / slabs
    col = mix(basalt, vec3(0.13, 0.125, 0.12), ashM * 0.30) * (0.80 + 0.40 * r4);
    dens = uDensity * (0.30 + 0.70 * clump) * slopeB * (1.0 + 1.6 * rubble * uXP.x) * lavaOK * padK;
  } else if (uRule < 1.5) {     // cinder gravel
    col = mix(vec3(0.030, 0.027, 0.028), vec3(0.15, 0.058, 0.034), r5 * r5) * (0.7 + 0.6 * r4);
    col = mix(col, vec3(0.13, 0.125, 0.12), ashM * 0.25);
    dens = uDensity * (0.45 + 0.55 * smoothstep(0.2, 0.8, sfVN2(gP * 0.19, uSeed + 311u))) * smoothstep(wc + 1.0, wc + 4.0, rdist) * padK;
  } else {                      // columnar jointing outcrops
    col = mix(basalt, vec3(0.035, 0.034, 0.038), 0.5) * (0.85 + 0.3 * r4);
    float outc = smoothstep(0.50, 0.85, sfVN2(gP * 0.011 + 3.0, uSeed + 331u));
    dens = uDensity * (0.15 + 0.85 * outc) * (0.35 + 2.2 * smoothstep(0.04, 0.30, slope) + 1.2 * rubble * uXP.x) * lavaOK * padK;
  }`,

  // airless regolith: many small angular boulders, few large; pale bluish ice boulders; blocks pile up on crater rims and slopes
  charon: /* glsl */ `
  float m1 = sfVN2(gP * 0.008, uSeed + 3u), m2 = sfVN2(gP * 0.05, uSeed + 5u), m3 = sfVN2(gP * 0.33, uSeed + 7u);
  float clump = smoothstep(0.22, 0.80, sfVN2(gP * 0.03 + 5.0, uSeed + 301u));
  float slopeB = 0.6 + 2.2 * smoothstep(0.04, 0.30, slope);
  float rimB = 1.0;
  if (uP[1].z > 1.0) { float q = length(gP - uP[1].xy) / uP[1].z; float rl = (q - 1.0) / 0.10; rimB += 2.2 * exp(-rl * rl); }
  vec3 reg = mix(vec3(0.165, 0.150, 0.138), vec3(0.285, 0.265, 0.245), m2 * 0.6 + m3 * 0.4);
  if (uRule < 0.5) {            // regolith boulders
    col = reg * mix(0.45, 1.12, r4) * mix(vec3(1.0), vec3(0.62, 0.64, 0.70), step(0.86, r5));
    dens = uDensity * (0.35 + 0.65 * clump) * slopeB * rimB * padK;
  } else {                      // ice boulders
    float iceF = smoothstep(0.30, 0.75, m1 * 0.55 + m2 * 0.5 + (r5 - 0.5) * 0.25);
    col = vec3(0.30, 0.41, 0.56) * (0.85 + 0.30 * r4);
    dens = uDensity * (0.15 + 0.85 * iceF) * (0.7 + 0.6 * clump) * (0.7 + 0.5 * slopeB) * padK;
  }`,

  // frozen: translucent ice shards (tiny chips on the lake), dark rocks with snow caps; vents + lake interior kept clear
  cocytus: /* glsl */ `
  float lakeIn = -1e4;
  if (uP[1].z > 1.0) lakeIn = uP[1].z - length(gP - uP[1].xy);
  float onLake = smoothstep(-6.0, 4.0, lakeIn);
  float ventOK = 1.0;
  for (int i = 0; i < 8; i++){ if (i >= uVN) break; ventOK *= smoothstep(uV[i].z * 0.26, uV[i].z * 0.72, length(gP - uV[i].xy)); }
  float clump = smoothstep(0.25, 0.80, sfVN2(gP * 0.028 + 7.0, uSeed + 301u));
  float slopeB = 0.6 + 2.0 * smoothstep(0.03, 0.30, slope);
  if (uRule < 0.5) {            // ice shards / blocks
    col = mix(vec3(0.42, 0.64, 0.88), vec3(0.80, 0.91, 1.0), r4 * r4) * (0.9 + 0.12 * r5);
    size *= mix(1.0, uXP.y, onLake);
    dens = uDensity * (0.30 + 0.70 * clump) * mix(1.0, uXP.x, onLake) * ventOK * padK * (0.7 + 0.5 * slopeB);
  } else {                      // snow-capped dark rocks
    col = mix(vec3(0.045, 0.050, 0.062), vec3(0.115, 0.118, 0.135), r4) * (0.85 + 0.3 * r5);
    dens = uDensity * (0.25 + 0.75 * clump) * slopeB * (1.0 - onLake) * ventOK * padK;
  }`,

  // dark glass plains: fields of phosphorescent crystal clusters (hue field cyan ↔ violet, magenta accents). The density maths is mirrored in JS (collisions).
  elysium: /* glsl */ `
  float cd = uP[0].z;
  float clear = smoothstep(0.26, 0.60, sfVN2(gP * 0.021, uSeed + 111u));
  dens = uDensity * cd * (0.12 + 0.88 * clear) * padK;
  float hueB = sfVN2(gP * 0.007, uSeed + 117u);
  float hue = clamp((hueB - 0.5) * 2.4 + 0.5 + (r4 - 0.5) * 0.55, 0.0, 1.0);
  float emis = mix(0.8, 3.5, pow(r5, 1.3));
  float acc = step(0.88, sfR(ic, sd + 8u));
  col = vec3(hue, emis, acc);`,
};

export function bakeFrag(biome) {
  return BAKE_HEAD.replace('@RIVER@', biome === 'phlegethon' ? GLSL_RIVER_FN : '') + RULES[biome] + BAKE_TAIL;
}

// ───────────────────────────── instance vertex programs ─────────────────────────────
const VS_HASH = /* glsl */ `
uint sfH(ivec2 p, uint seed){
  uint h = uint(p.x) * 0x27d4eb2du + uint(p.y) * 0x165667b1u + seed * 0x9e3779b9u + 0x85ebca6bu;
  h ^= h >> 15u; h *= 0x2c1b3c6du; h ^= h >> 12u; h *= 0x297a2d39u; h ^= h >> 15u;
  return h;
}
float sfR(ivec2 p, uint seed){ return float(sfH(p, seed) >> 8u) * (1.0 / 16777216.0); }
vec3 sfRotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
vec3 sfRotX(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }
vec3 sfRotZ(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }
`;

const VS_COMMON = /* glsl */ `
attribute vec2 aSlot;
uniform highp sampler2D uPlace;
uniform float uTime;
uniform vec4 uShape; uniform vec4 uShape2; uniform vec4 uShape3;
`;
const VS_VARY = /* glsl */ `varying vec3 vSfCol; varying vec4 vSfInfo; varying vec3 vSfP; varying vec2 vSfRing;\n`;

const FETCH = /* glsl */ `
  ivec2 sfS = ivec2(aSlot);
  vec4 sfA = texelFetch(uPlace, ivec2(sfS.x * 2, sfS.y), 0);
  vec4 sfB = texelFetch(uPlace, ivec2(sfS.x * 2 + 1, sfS.y), 0);
  int sfSd = int(sfB.w);
  float sfSz = sfA.w;
`;

// empty slots (size 0) skip all of the hashing/trig: every vertex collapses onto the slot position (degenerate, culled)
// rock: random convex polytope carved out of the unit sphere (box planes + 6 oblique planes), jittered per vertex, stretched, tumbled
const ROCK_PLACE = /* glsl */ `${FETCH}
  vec3 sfPos = sfA.xyz, sfNv = vec3(0.0, 1.0, 0.0);
  if (sfSz > 0.0) {
    vec3 sfD = normalize(position);
    vec3 sfHx = vec3(0.60 + 0.40 * sfR(ivec2(sfSd, 1), 11u), (0.60 + 0.40 * sfR(ivec2(sfSd, 2), 11u)) * uShape.x, 0.60 + 0.40 * sfR(ivec2(sfSd, 3), 11u));
    vec3 sfAd = abs(sfD) + 1e-4;
    float sfRr = min(min(sfHx.x / sfAd.x, sfHx.y / sfAd.y), sfHx.z / sfAd.z);
    float sfHm = (sfHx.x + sfHx.y + sfHx.z) * 0.3333;
    for (int k = 0; k < 6; k++) {
      int kk = 8 + k * 4;
      vec3 pn = normalize(vec3(sfR(ivec2(sfSd, kk), 11u), sfR(ivec2(sfSd, kk + 1), 11u), sfR(ivec2(sfSd, kk + 2), 11u)) * 2.0 - 1.0);
      sfRr = min(sfRr, sfHm * (0.74 + 0.50 * sfR(ivec2(sfSd, kk + 3), 11u)) / max(dot(sfD, pn), 1e-3));
    }
    sfRr *= 1.0 + uShape.w * (sfR(ivec2(sfSd, 64 + gl_VertexID), 12u) - 0.5);
    float sfYaw = 6.2831853 * sfR(ivec2(sfSd, 4), 11u);
    float sfPit = (sfR(ivec2(sfSd, 5), 11u) - 0.5) * 2.0 * uShape.y;
    float sfRol = (sfR(ivec2(sfSd, 6), 11u) - 0.5) * 2.0 * uShape.y;
    float sfEl = 0.70 + 0.75 * sfR(ivec2(sfSd, 7), 11u);
    vec3 sfQ = sfD * sfRr; sfQ.x *= sfEl; sfQ.z /= sqrt(sfEl);
    sfPos = sfA.xyz + sfRotY(sfRotX(sfRotZ(sfQ * (0.5 * sfSz), sfRol), sfPit), sfYaw) - vec3(0.0, uShape.z * 0.5 * sfSz * sfHx.y, 0.0);
    sfNv = sfRotY(sfRotX(sfRotZ(sfD, sfRol), sfPit), sfYaw);
  }
`;

// basalt column cluster: 19 hex columns, heights hashed per column, tilted broken tops, random yaw
const COLUMN_PLACE = /* glsl */ `${FETCH}
  float sfRh = 0.0, sfHc = 0.0, sfYy = 0.0;
  vec3 sfPos = sfA.xyz, sfNv = vec3(0.0, 1.0, 0.0);
  if (sfSz > 0.0) {
    int sfCid = int(aCol.z + 0.5);
    vec2 sfLat = aCol.xy;
    float sfRing = length(sfLat) * 0.5774;
    sfRh = sfR(ivec2(sfSd, 20 + sfCid), 31u);
    float sfPres = step(0.14 + 0.10 * sfRing, sfR(ivec2(sfSd, 60 + sfCid), 31u));
    float sfColR = clamp(uShape.x + 0.045 * sfSz, 0.26, 0.85);
    sfHc = sfSz * (0.34 + 0.66 * sfRh) * (1.0 - 0.22 * sfRing) * sfPres;
    vec2 sfLoc = position.xz - sfLat;
    vec2 sfTg = (vec2(sfR(ivec2(sfSd, 100 + sfCid), 32u), sfR(ivec2(sfSd, 140 + sfCid), 32u)) - 0.5) * 1.1;
    sfYy = position.y > 0.0 ? sfHc + dot(sfLoc, sfTg) * sfColR : -(0.35 + 0.16 * sfSz);
    float sfYaw = 6.2831853 * sfR(ivec2(sfSd, 4), 31u);
    sfPos = sfA.xyz + sfRotY(vec3(position.x * sfColR, sfYy, position.z * sfColR), sfYaw);
    sfNv = sfRotY(normalize(vec3(sfLoc.x, 0.30, sfLoc.y)), sfYaw);
  }
`;

// crystal cluster: up to 6 hexagonal prisms with bevelled pointed tips leaning out of a shared base; all parameters hashed from the seed (JS twin in flora_scatter.js)
const GEM_PLACE = /* glsl */ `${FETCH}
  int sfCi = int(aCry.x + 0.5);
  float sfRole = aCry.y;
  float sfYf = 0.0;
  vec3 sfPos = sfA.xyz, sfNv = vec3(0.0, 1.0, 0.0);
  if (sfSz > 0.0) {
    int sfCnt = min(int(uShape.x) + int(floor(sfR(ivec2(sfSd, 1), 21u) * (uShape.y - uShape.x + 1.0))), int(uShape.y));
    bool sfMain = sfCi == 0;
    float sfAj = sfR(ivec2(sfSd, 10 + sfCi), 21u);
    float sfAng = 6.2831853 * (sfR(ivec2(sfSd, 2), 21u) + (float(sfCi) - 1.0 + 0.7 * sfAj) / max(float(sfCnt) - 1.0, 1.0));
    float sfDst = sfMain ? 0.0 : (0.30 + 0.55 * sfR(ivec2(sfSd, 20 + sfCi), 21u)) * sfSz * uShape.z;
    float sfBlk = step(1.0 - uShape3.x, sfR(ivec2(sfSd, 3), 21u));
    float sfLenB = sfSz * (sfMain ? 1.0 : 0.36 + 0.52 * sfR(ivec2(sfSd, 30 + sfCi), 21u));
    float sfLen = sfLenB * mix(1.0, uShape3.z, sfBlk);
    float sfRad = max(sfLenB * (uShape2.x + uShape2.y * sfR(ivec2(sfSd, 40 + sfCi), 21u)) * mix(1.0, uShape3.y, sfBlk), 0.02);
    float sfTilt = (sfMain ? 0.25 : 1.0) * uShape.w * (0.35 + 0.65 * sfR(ivec2(sfSd, 50 + sfCi), 21u));
    float sfTd = sfAng + (sfR(ivec2(sfSd, 60 + sfCi), 21u) - 0.5) * 0.8;
    float sfHy = 1.0471976 * sfR(ivec2(sfSd, 70 + sfCi), 21u);
    float sfTipS = uShape2.z + 0.2 * (sfR(ivec2(sfSd, 80 + sfCi), 21u) - 0.5);
    vec2 sfApx = (vec2(sfR(ivec2(sfSd, 90 + sfCi), 21u), sfR(ivec2(sfSd, 100 + sfCi), 21u)) - 0.5) * uShape2.w;
    sfYf = sfRole < 0.5 ? -0.12 : (sfRole < 1.5 ? sfTipS : (sfRole < 2.5 ? sfTipS + 0.07 + 0.05 * sfAj : 1.0));
    vec2 sfRxz = position.xz + sfApx * (sfRole > 2.5 ? 1.0 : (sfRole > 1.5 ? 0.35 : 0.0));
    { float c = cos(sfHy), s = sin(sfHy); sfRxz = vec2(c * sfRxz.x + s * sfRxz.y, -s * sfRxz.x + c * sfRxz.y); }
    vec3 sfLp = vec3(sfRxz.x * sfRad, sfYf * sfLen, sfRxz.y * sfRad);
    sfLp.xz += vec2(cos(sfTd), sin(sfTd)) * tan(sfTilt) * sfLp.y;
    sfLp.y *= cos(sfTilt);
    sfLp.xz += vec2(cos(sfAng), sin(sfAng)) * sfDst;
    if (sfCi >= sfCnt) sfLp = vec3(0.0);
    sfPos = sfA.xyz + sfLp;
    sfNv = sfRole > 2.5 ? vec3(0.0, 1.0, 0.0) : normalize(vec3(sfRxz.x, sfRole > 1.5 ? 0.8 : 0.05, sfRxz.y));
  }
`;

const VARY_ROCK = (river) => /* glsl */ `
  vSfCol = sfB.rgb * (0.9 + 0.2 * sfR(ivec2(sfSd, 8), 11u));
  vSfP = sfPos;
  vSfInfo = vec4(mix(0.46, 1.0, smoothstep(-0.70, 0.45, sfNv.y)), ${river ? 'sfRiverDist(sfA.xz)' : '0.0'}, sfPos.y - sfA.y, sfSz);
`;
const VARY_COLUMN = (river) => /* glsl */ `
  vSfCol = sfB.rgb * (0.82 + 0.34 * sfRh);
  vSfP = sfPos;
  vSfInfo = vec4(mix(0.42, 1.0, smoothstep(-0.2, 0.7, sfYy / max(sfHc, 0.3))), ${river ? 'sfRiverDist(sfA.xz)' : '0.0'}, sfPos.y - sfA.y, -sfSz);
`;
const VARY_GEM = (ice) => /* glsl */ `
  vec3 sfCc = sfB.rgb;
  if (sfSz > 0.0) {
  ${ice ? 'sfCc = sfB.rgb * (0.92 + 0.16 * sfR(ivec2(sfSd, 110 + sfCi), 21u));' : `
    float sfCh = clamp(sfB.x + (sfR(ivec2(sfSd, 110 + sfCi), 21u) - 0.5) * 0.30, 0.0, 1.0);
    sfCc = mix(vec3(0.05, 0.70, 1.0), vec3(0.50, 0.15, 1.0), sfCh);
    sfCc = mix(sfCc, vec3(1.0, 0.20, 0.80), sfB.z * step(0.35, sfR(ivec2(sfSd, 120 + sfCi), 21u)));`}
  }
  vSfCol = sfCc;
  vSfP = sfPos;
  vSfRing = position.xz;
  vSfInfo = vec4(clamp(sfYf, 0.0, 1.0), sfB.y, sfR(ivec2(sfSd, 130 + sfCi), 21u) * 6.2831853, sfRole);
`;

/** vertex shader pieces for an instance kind. depth = MeshDepthMaterial variant (no normals / varyings). */
export function instanceVS(kind, o = {}, depth = false) {
  const river = !!o.river, ice = !!o.ice;
  const attr = kind === 'column' ? 'attribute vec3 aCol;\n' : kind === 'gem' ? 'attribute vec2 aCry;\n' : '';
  const place = kind === 'rock' ? ROCK_PLACE : kind === 'column' ? COLUMN_PLACE : GEM_PLACE;
  const vary = kind === 'rock' ? VARY_ROCK(river) : kind === 'column' ? VARY_COLUMN(river) : VARY_GEM(ice);
  const decl = VS_HASH + VS_COMMON + attr + (river ? 'uniform vec4 uP[8];\n' + GLSL_RIVER_FN : '') + (depth ? '' : VS_VARY);
  if (depth) return { decl, normal: null, begin: place + '\nvec3 transformed = sfPos;\n' };
  return { decl, normal: place + vary + '\nvec3 objectNormal = sfNv;\n', begin: 'vec3 transformed = sfPos;\n' };
}

// ───────────────────────────── fragment injections ─────────────────────────────
export const FS_COMMON_DECL = /* glsl */ `
varying vec3 vSfCol; varying vec4 vSfInfo; varying vec3 vSfP; varying vec2 vSfRing;
uniform float uTime;
${GLSL_NOISE}
`;

export const FS_ROCK = {
  decl: /* glsl */ `uniform vec4 uRockM; uniform vec4 uRockN;\n`,   // M = (bump, snow, rim, vesicle) · N = (wLava, rimFall, sss, refl)
  color: /* glsl */ `diffuseColor.rgb = vSfCol * vSfInfo.x;`,
  normal: /* glsl */ `
  {
    float sfFd = 1.0 - smoothstep(6.0, 55.0, length(vViewPosition));
    vec4 sn1 = sfVN3(vSfP * 2.3, 31u), sn2 = sfVN3(vSfP * 9.0 + 3.1, 32u), sn3 = sfVN3(vSfP * 31.0 + 7.7, 33u);
    vec3 sgr = sn2.yzw * 0.50 + sn3.yzw * 0.40 * sfFd;
    vec3 sgv = (viewMatrix * vec4(sgr * uRockM.x, 0.0)).xyz; sgv -= normal * dot(sgv, normal);
    normal = normalize(normal - sgv);
    vec3 snW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    float sfa = fract(sin(dot(floor(snW * 4.0 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float snd = sn1.x * 0.5 + sn2.x * 0.32 + sn3.x * 0.18 * sfFd;
    diffuseColor.rgb *= (0.62 + 0.76 * snd) * (0.86 + 0.28 * sfa);
    float shr = vSfInfo.z / max(abs(vSfInfo.w), 0.05);
    diffuseColor.rgb *= mix(0.50, 1.0, smoothstep(-0.08, 0.22, shr));                     // contact shadow where the block meets the ground
    if (vSfInfo.w < 0.0) {                                                                // basalt columns: cross joints with a per-column phase
      float sph = sfR(ivec2(floor(vSfP.x * 1.4), floor(vSfP.z * 1.4)), 77u) * 7.0;
      float sjl = abs(fract(vSfP.y * 1.15 + sph) - 0.5);
      diffuseColor.rgb *= 1.0 - 0.45 * smoothstep(0.455, 0.49, sjl);
    }
    diffuseColor.rgb *= 1.0 - uRockM.w * smoothstep(0.66, 0.76, sn2.x);
    float ssn = uRockM.y * smoothstep(0.34, 0.74, snW.y + (snd - 0.5) * 0.7);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.80, 0.88) * (0.9 + 0.2 * sn3.x), ssn);
    roughnessFactor = mix(roughnessFactor, 0.80, ssn);
  }`,
  emissive: /* glsl */ `
  if (uRockM.z > 0.0) {
    vec3 srW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    float srD = vSfInfo.y;
    float srProx = exp(-max(abs(srD) - uRockN.x, 0.0) / uRockN.y);
    float srToward = clamp(srW.x * (srD > 0.0 ? -1.0 : 1.0), 0.0, 1.0);
    float srLow = 1.0 - smoothstep(0.3, 0.9, vSfInfo.x);
    totalEmissiveRadiance += vec3(1.0, 0.24, 0.045) * uRockM.z * srProx * (0.18 + 0.82 * srToward) * (0.35 + 0.65 * srLow + 0.25 * srW.y) * (0.86 + 0.14 * sin(uTime * 1.3 + vSfP.z * 0.2));
  }
  if (uRockN.z > 0.0) {                                  // ice boulders: deep-blue translucency + sky mirror
    vec3 sV = normalize(vViewPosition);
    float snv = clamp(dot(normal, sV), 0.0, 1.0), sfr = pow(1.0 - snv, 2.2);
    vec3 sunV = normalize((viewMatrix * vec4(uAtSun, 0.0)).xyz);
    float sback = pow(clamp(dot(-sV, sunV), 0.0, 1.0), 2.5);
    totalEmissiveRadiance += (vec3(0.10, 0.30, 0.62) * (0.05 + 0.22 * sfr) + vSfCol * uAtSunCol * (0.30 * sfr * sfr + 0.9 * sback * (0.25 + sfr))) * uRockN.z;
    vec3 srf = normalize((vec4(reflect(-sV, normal), 0.0) * viewMatrix).xyz);
    totalEmissiveRadiance += uRockN.w * (0.04 + 0.96 * sfr) * sfSkyRefl(srf);
  }`,
};

export const FS_GEM = {
  decl: /* glsl */ `uniform vec4 uGemM;\n`,                           // (emissive K, sss K, reflection K, albedo K)
  color: /* glsl */ `diffuseColor.rgb = vSfCol * uGemM.w;`,
  emissive: /* glsl */ `
  {
    vec3 sV = normalize(vViewPosition);
    float snv = clamp(dot(normal, sV), 0.0, 1.0);
    float sfr = pow(1.0 - snv, 2.2);
    vec3 snW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    float sfa = fract(sin(dot(floor(snW * 4.0 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float sh = clamp(vSfInfo.x, 0.0, 1.0);
    float sgrad = mix(0.03, 1.0, pow(sh, 2.4));
    float spul = 0.88 + 0.12 * sin(uTime * 0.85 + vSfInfo.z);
    vec3 core = vSfCol * vSfInfo.y * spul * uGemM.x;
    vec3 sem = core * sgrad * (0.55 + 0.45 * snv) * (0.74 + 0.52 * sfa) + core * 0.30 * sfr * (0.3 + 0.7 * sgrad);
    vec3 sunV = normalize((viewMatrix * vec4(uAtSun, 0.0)).xyz);
    float sback = pow(clamp(dot(-sV, sunV), 0.0, 1.0), 2.5);
    sem += (vec3(0.10, 0.30, 0.62) * (0.05 + 0.22 * sfr) * (0.6 + 0.4 * sh) + vSfCol * uAtSunCol * (0.30 * sfr * sfr + 0.9 * sback * (0.25 + sfr) + 0.08 * sh)) * uGemM.y;
    vec3 srf = normalize((vec4(reflect(-sV, normal), 0.0) * viewMatrix).xyz);
    sem += uGemM.z * (0.04 + 0.96 * sfr) * sfSkyRefl(srf) * (0.8 + 0.4 * sfa);
    if (vSfInfo.w >= 0.0) {                              // jewel edges: bright lines on the 6 facet ridges, chamfer band, pyramid ridges
      float sang = atan(vSfRing.y, vSfRing.x) * 0.95492966;
      float su = fract(sang), sed = min(su, 1.0 - su), sw = max(fwidth(sang) * 1.4, 0.05);
      float sedge = (1.0 - smoothstep(0.0, sw, sed)) * smoothstep(0.02, 0.10, length(vSfRing));
      float sband = smoothstep(0.98, 1.06, vSfInfo.w) * (1.0 - smoothstep(1.88, 2.04, vSfInfo.w));
      vec3 sCol = mix(vSfCol, vec3(1.0), 0.45);
      sem += sCol * (vSfInfo.y * uGemM.x * spul * (0.34 * sedge * (0.20 + 0.80 * sgrad) + 0.36 * sband * (0.3 + 0.7 * sgrad)) + uAtSunCol * uGemM.y * (0.16 * sedge + 0.14 * sband) * (0.4 + 0.6 * sback + 0.4 * sh));
    }
    totalEmissiveRadiance += sem;
  }`,
};
