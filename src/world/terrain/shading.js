// ORPHEUS · surface · per-biome terrain surface shading (GLSL).
// Each biome supplies   void sfSurface(vec3 wp, vec3 n, float h, float dist, out vec3 alb, out float rough, out vec3 emis, out vec3 bump, out float refl)
//   wp   : local (ship-space) position   n : unit terrain normal (local axes)   h : terrain height rel. pad (m, no curvature)
//   alb  : albedo (linear)   rough : roughness   emis : HDR emissive   bump : gradient vector (local axes) used to perturb the normal   refl : mirror-sky strength (0..1, × fresnel)
// Available (common): uTime, uSeed, uP[], uSeaY, sfRiverDist (phlegethon), noise helpers (noise.js GLSL), sfDet().

export const GLSL_SHADE_COMMON = /* glsl */ `
uniform float uTime; uniform float uSeaY;
// three-octave value noise + analytic gradient. f0 = base frequency (1/m). returns (value, d/dx, d/dy, d/dz) of the weighted sum.
float sfPx = 0.0;                                   // pixel footprint (m) at this fragment, set by the caller
float sfAA(float lam){ return smoothstep(2.0 * sfPx, 6.0 * sfPx, lam); }          // 1 when a feature of wavelength lam is resolvable, 0 when it would alias
vec4 sfDet(vec3 p, uint seed, float f0, float fade){
  if (fade <= 0.002) return vec4(0.5, 0.0, 0.0, 0.0);      // far pixels skip the whole noise stack
  float f1 = f0 * 2.37, f2 = f0 * 5.71;
  float aA = sfAA(1.0 / f0), aB = sfAA(1.0 / f1), aC = sfAA(1.0 / f2);
  float wb = 0.5 * fade, wc = 0.25 * fade * fade;
  vec4 a = vec4(0.5, 0.0, 0.0, 0.0), b = a, c = a;
  if (aA > 0.001) a = sfVN3(p * f0, seed);
  if (aB > 0.001) b = sfVN3(p * f1 + 7.1, seed + 1u);
  if (aC > 0.001) c = sfVN3(p * f2 + 3.3, seed + 2u);
  float v = mix(0.5, a.x, aA) + mix(0.5, b.x, aB) * wb + mix(0.5, c.x, aC) * wc;
  vec3 g = a.yzw * (f0 * aA) + b.yzw * (f1 * wb * aB) + c.yzw * (f2 * wc * aC);
  return vec4(v, g);
}
// cellular noise: x = distance to nearest feature (cell units), y = distance gap to the 2nd nearest (0 on cell edges); id = random of the nearest cell
vec2 sfWorley(vec2 p, uint seed, out float id){
  vec2 ip = floor(p), fp = p - ip; float d1 = 8.0, d2 = 8.0; ivec2 best = ivec2(0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    ivec2 c = ivec2(ip) + ivec2(i, j);
    vec2 r = vec2(float(i), float(j)) + vec2(sfR(c, seed), sfR(c, seed + 1u)) - fp;
    float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; best = c; } else if (d < d2) d2 = d;
  }
  id = sfR(best, seed + 7u);
  return vec2(sqrt(d1), sqrt(d2) - sqrt(d1));
}
vec4 sfDetHi(vec3 p, uint seed, float fade){ return sfDet(p, seed, 7.0, fade); }
float sfBand(float x, float w){ return smoothstep(0.0, w, x) * (1.0 - smoothstep(1.0 - w, 1.0, x)); }
`;

export const GLSL_SURFACE = {
  // ───────────────────────────── ASPHODEL: silver-grey meadow, black sand, grey rock ─────────────────────────────
  asphodel: /* glsl */ `
void sfSurface(vec3 wp, vec3 n, float h, float dist, out vec3 alb, out float rough, out vec3 emis, out vec3 bump, out float refl){
  float slope = 1.0 - n.y;
  float fade = 1.0 - smoothstep(25.0, 150.0, dist);
  float m1 = sfVN2(wp.xz * 0.011, uSeed + 3u), m2 = sfVN2(wp.xz * 0.065, uSeed + 5u), m3 = sfVN2(wp.xz * 0.42, uSeed + 7u), m4 = mix(0.5, sfVN2(wp.xz * 2.3, uSeed + 8u), sfAA(0.43));
  vec3 gA = vec3(0.36, 0.40, 0.36), gB = vec3(0.57, 0.61, 0.56), gC = vec3(0.50, 0.465, 0.35);
  vec3 grass = mix(gA, gB, smoothstep(0.15, 0.95, m2 * 0.6 + m3 * 0.25 + m1 * 0.15));
  grass = mix(grass, gC, smoothstep(0.60, 0.86, m1) * 0.5);
  grass *= 0.86 + 0.20 * m3 + 0.10 * m4 * fade;
  float strata = sfVN2(vec2(h * 1.6, 0.5) + wp.xz * 0.015, uSeed + 9u);
  vec3 rock = mix(vec3(0.17, 0.165, 0.16), vec3(0.34, 0.325, 0.30), strata) * (0.85 + 0.3 * m4);
  float rockM = smoothstep(0.30, 0.52, slope);
  float e = h - uSeaY;
  float wet = 1.0 - smoothstep(-0.15, 0.55, e);
  float beach = 1.0 - smoothstep(1.7, 3.3, e);
  float enc = smoothstep(0.30, 0.70, m2 + (e - 1.8) * 0.20);
  vec3 sandDry = vec3(0.052, 0.052, 0.058), sandWet = vec3(0.016, 0.017, 0.021);
  vec3 sand = mix(sandDry, sandWet, wet) * (0.75 + 0.5 * m3);
  float sandM = beach * (1.0 - enc * 0.85) * (1.0 - rockM * 0.9);
  alb = mix(mix(grass * 0.72, rock, rockM), sand, sandM);
  float under = 1.0 - smoothstep(-0.9, -0.05, e);
  alb = mix(alb, vec3(0.045, 0.058, 0.060), under * sandM);
  rough = mix(mix(0.96, 0.82, rockM), mix(0.88, 0.22, wet), sandM);
  emis = vec3(0.0);
  float gm = (1.0 - rockM) * (1.0 - sandM);
  vec4 d = sfDet(wp, uSeed + 21u, 1.7, fade);
  vec4 d2 = sfDet(wp * vec3(1.0, 0.3, 1.0), uSeed + 25u, 0.35, fade);
  vec4 dh = sfDetHi(wp, uSeed + 27u, fade * (1.0 - smoothstep(5.0, 20.0, dist)));
  alb *= 0.93 + 0.14 * dh.x;
  bump = (d.yzw * 0.06 * gm + d2.yzw * 0.30 * rockM + d.yzw * 0.03 * sandM + dh.yzw * 0.022 * (gm + sandM)) * fade
       + vec3(cos(wp.x * 7.0 + d2.x * 5.0), 0.0, sin(wp.z * 6.0 + d2.x * 4.0)) * 0.02 * sandM * fade * (1.0 - wet);
  refl = wet * sandM * 0.8 * smoothstep(-0.05, 0.15, e);
}`,

  // ───────────────────────────── PHLEGETHON: black basalt, ash, glowing lava river + fissures ─────────────────────────────
  phlegethon: /* glsl */ `
void sfSurface(vec3 wp, vec3 n, float h, float dist, out vec3 alb, out float rough, out vec3 emis, out vec3 bump, out float refl){
  float slope = 1.0 - n.y;
  float fade = 1.0 - smoothstep(30.0, 170.0, dist);
  float m1 = sfVN2(wp.xz * 0.02, uSeed + 3u), m2 = sfVN2(wp.xz * 0.11, uSeed + 5u), m3 = sfVN2(wp.xz * 0.6, uSeed + 7u), m4 = mix(0.5, sfVN2(wp.xz * 3.1, uSeed + 8u), sfAA(0.32));
  vec3 basalt = mix(vec3(0.020, 0.019, 0.021), vec3(0.060, 0.056, 0.058), m3);
  basalt = mix(basalt, vec3(0.105, 0.044, 0.028), smoothstep(0.58, 0.82, m1) * 0.7);       // oxidised flows
  float ashM = smoothstep(0.50, 0.78, m2 * 0.7 + m1 * 0.5) * smoothstep(0.45, 0.12, slope);
  vec3 ash = vec3(0.145, 0.14, 0.135) * (0.8 + 0.4 * m4);
  alb = mix(basalt, ash, ashM) * (0.82 + 0.3 * m4 * fade);
  vec4 d = sfDet(wp, uSeed + 31u, 0.9, fade), d2 = sfDet(wp, uSeed + 33u, 0.12, fade);
  float vesic = smoothstep(0.62, 0.72, d.x) * (1.0 - ashM);
  alb *= 1.0 - 0.45 * vesic;
  rough = mix(0.78, 0.95, ashM);
  emis = vec3(0.0); refl = 0.0;
  // lava river
  float rd = abs(sfRiverDist(wp.xz)), wl = uP[2].w;
  float lavaM = 1.0 - smoothstep(wl * 0.82, wl * 1.10, rd);
  vec2 fl = vec2(wp.x, wp.z - uTime * 0.7);
  float ln = sfVN2(fl * 0.22, uSeed + 41u) * 0.55 + sfVN2(fl * 0.55 + 4.0, uSeed + 43u) * 0.30 + sfVN2(fl * 1.5 + 9.0, uSeed + 45u) * 0.15;
  float crack = 1.0 - smoothstep(0.02, 0.17, abs(ln - 0.5));
  float pulse = 0.88 + 0.12 * sin(uTime * 0.9 + ln * 9.0);
  vec3 hot = mix(vec3(1.0, 0.22, 0.03), vec3(1.0, 0.72, 0.22), crack);
  vec3 lava = hot * (0.5 + 5.5 * crack * crack + 1.3 * smoothstep(0.35, 0.6, ln)) * pulse;
  vec3 crust = vec3(0.016, 0.012, 0.011);
  emis = mix(vec3(0.0), lava, lavaM);
  alb = mix(alb, crust, lavaM);
  // bank heat glow
  float bank = exp(-max(rd - wl, 0.0) / (wl * 0.9)) * (1.0 - lavaM);
  emis += vec3(0.8, 0.16, 0.025) * bank * 0.55 * (0.5 + 0.5 * m3);
  // fissure network: polygonal cooling cracks, hot only inside active zones
  float fz = uP[3].z;
  if (fz > 0.001) {
    vec2 wq = wp.xz + 5.5 * vec2(sfNoise(wp.xz * 0.045 + vec2(1.7, 9.2), uSeed + 56u), sfNoise(wp.xz * 0.045 + vec2(6.1, 2.8), uSeed + 57u));   // organic, warped plates
    float pid; vec2 w1 = sfWorley(wq / 17.0 + vec2(3.7, 1.9), uSeed + 51u, pid);
    float pid2 = 0.0; vec2 w2 = vec2(1.0);
    if (dist < 95.0) w2 = sfWorley(wq / 4.6 + vec2(8.1, 2.2), uSeed + 55u, pid2);
    float widen = dist * 0.00045;
    float e1 = 1.0 - smoothstep(0.0, 0.016 + widen / 17.0 * 1.0, w1.y);
    float e2 = (1.0 - smoothstep(0.0, 0.034 + widen / 4.6, w2.y)) * (1.0 - smoothstep(25.0, 90.0, dist));
    float act = smoothstep(-0.55 + 0.4 * (1.0 - fz), 0.15, sfNoise(wp.xz * 0.0065 + vec2(2.3, 7.7), uSeed + 53u)) * fz;
    float heat = (0.10 + 0.90 * smoothstep(0.25, 0.85, pid)) * (0.25 + 0.75 * smoothstep(0.30, 0.78, sfVN2(wp.xz * 0.12 + vec2(4.4, 1.3), uSeed + 58u)));
    float fc = (e1 * heat + e2 * 0.55 * pid2) * act * (1.0 - lavaM) * (1.0 - smoothstep(350.0, 1400.0, dist));
    emis += vec3(1.0, 0.30, 0.05) * fc * (1.1 + 2.4 * smoothstep(0.45, 0.85, m3)) * (0.78 + 0.22 * sin(uTime * 1.3 + pid * 40.0));
    alb *= 1.0 - min(fc, 1.0) * 0.55;
    alb *= 0.78 + 0.44 * pid;      // plate-to-plate tone
  }
  vec4 dh = sfDetHi(wp, uSeed + 35u, fade * (1.0 - smoothstep(6.0, 24.0, dist)));
  alb *= 0.9 + 0.2 * dh.x;
  bump = (d.yzw * 0.18 * (1.0 - ashM) + d2.yzw * 0.4 + d.yzw * 0.06 * ashM + dh.yzw * 0.05) * fade * (1.0 - lavaM * 0.7);
}`,

  // ───────────────────────────── CHARON: airless regolith + ice ─────────────────────────────
  charon: /* glsl */ `
void sfSurface(vec3 wp, vec3 n, float h, float dist, out vec3 alb, out float rough, out vec3 emis, out vec3 bump, out float refl){
  float slope = 1.0 - n.y;
  float fade = 1.0 - smoothstep(40.0, 260.0, dist);
  float m1 = sfVN2(wp.xz * 0.008, uSeed + 3u), m2 = sfVN2(wp.xz * 0.05, uSeed + 5u), m3 = sfVN2(wp.xz * 0.33, uSeed + 7u), m4 = mix(0.5, sfVN2(wp.xz * 2.1, uSeed + 8u), sfAA(0.48));
  vec3 reg = mix(vec3(0.165, 0.150, 0.138), vec3(0.285, 0.265, 0.245), m2 * 0.6 + m3 * 0.4);
  reg = mix(reg, vec3(0.13, 0.125, 0.125), smoothstep(0.55, 0.85, m1) * 0.35);
  float iceM = smoothstep(0.64, 0.84, m1 * 0.55 + m2 * 0.55) * smoothstep(0.5, 0.08, slope);
  vec3 ice = vec3(0.50, 0.56, 0.63) * (0.85 + 0.25 * m3);
  float fresh = smoothstep(0.30, 0.55, slope);      // steep crater walls expose bright material
  alb = mix(mix(reg, ice, iceM), vec3(0.42, 0.40, 0.37), fresh * 0.6) * (0.85 + 0.25 * m4 * fade);
  rough = mix(0.93, 0.35, iceM);
  emis = vec3(0.0); refl = 0.0;
  vec4 d = sfDet(wp, uSeed + 61u, 1.1, fade), d2 = sfDet(wp, uSeed + 63u, 0.14, fade);
  vec4 dh = sfDetHi(wp, uSeed + 67u, fade * (1.0 - smoothstep(5.0, 18.0, dist)));
  float peb = smoothstep(0.64, 0.72, sfVN2(wp.xz * 5.5, uSeed + 65u)) * fade;
  alb *= (1.0 - 0.14 * peb) * (0.92 + 0.16 * dh.x);
  bump = (d.yzw * 0.11 + d2.yzw * 0.12 + dh.yzw * 0.04) * fade;
}`,

  // ───────────────────────────── COCYTUS: snow, blue ice, crevasses ─────────────────────────────
  cocytus: /* glsl */ `
void sfSurface(vec3 wp, vec3 n, float h, float dist, out vec3 alb, out float rough, out vec3 emis, out vec3 bump, out float refl){
  float slope = 1.0 - n.y;
  float fade = 1.0 - smoothstep(30.0, 190.0, dist);
  float m1 = sfVN2(wp.xz * 0.009, uSeed + 3u), m2 = sfVN2(wp.xz * 0.06, uSeed + 5u), m3 = sfVN2(wp.xz * 0.37, uSeed + 7u), m4 = mix(0.5, sfVN2(wp.xz * 2.2, uSeed + 8u), sfAA(0.45));
  float lake = 0.0;
  if (uP[1].z > 1.0) lake = 1.0 - smoothstep(uP[1].z - uP[1].w, uP[1].z, length(wp.xz - uP[1].xy));
  vec3 snow = mix(vec3(0.70, 0.77, 0.86), vec3(0.88, 0.92, 0.97), m2 * 0.6 + m3 * 0.4);
  vec3 ice = mix(vec3(0.20, 0.40, 0.62), vec3(0.34, 0.56, 0.76), m3) * (0.8 + 0.3 * m4);
  float scour = smoothstep(0.58, 0.82, m1 * 0.6 + m2 * 0.45 + slope * 0.9);
  float iceM = clamp(max(scour * 0.85, lake * 0.95) + smoothstep(0.35, 0.6, slope) * 0.6, 0.0, 1.0);
  alb = mix(snow, ice, iceM) * (0.9 + 0.14 * m4 * fade);
  rough = mix(0.80, 0.13, iceM);
  emis = vec3(0.0);
  // crevasses (matches the geometry mask; visible as dark blue lines at all distances)
  float cn = sfFbm(wp.xz, uSeed + 13u, uP[0].w, 2, 0.5, max(0.5, dist * 0.004));
  float cmask = smoothstep(-0.05, 0.3, sfFbm(wp.xz, uSeed + 19u, uP[0].w * 3.0, 2, 0.5, 2.0));
  float crack = (1.0 - smoothstep(0.0, 0.05, abs(cn))) * cmask * (1.0 - lake * 0.9);
  alb = mix(alb, vec3(0.008, 0.03, 0.08), crack * 0.9);
  emis = vec3(0.01, 0.045, 0.11) * crack * 2.0;
  // geyser vents: steam-stained frost ring
  for (int i = 0; i < 8; i++){ if (i >= uVN) break; float q = length(wp.xz - uV[i].xy) / uV[i].z; alb = mix(alb, vec3(0.62, 0.70, 0.78), (1.0 - smoothstep(0.2, 1.0, q)) * 0.6); }
  refl = iceM * 0.9;
  vec4 d = sfDet(wp * vec3(0.35, 1.0, 1.0), uSeed + 71u, 0.9, fade), d2 = sfDet(wp, uSeed + 73u, 0.11, fade);
  bump = (d.yzw * 0.10 * (1.0 - iceM) + d2.yzw * 0.40 * iceM + d.yzw * 0.05) * fade;
}`,

  // ───────────────────────────── ELYSIUM: fractured dark-glass plates with phosphor-lit cracks ─────────────────────────────
  elysium: /* glsl */ `
void sfSurface(vec3 wp, vec3 n, float h, float dist, out vec3 alb, out float rough, out vec3 emis, out vec3 bump, out float refl){
  float slope = 1.0 - n.y;
  float fade = 1.0 - smoothstep(40.0, 240.0, dist);
  float m1 = sfVN2(wp.xz * 0.012, uSeed + 3u), m2 = sfVN2(wp.xz * 0.07, uSeed + 5u), m3 = sfVN2(wp.xz * 0.45, uSeed + 7u);
  vec2 wq = wp.xz + 4.5 * vec2(sfNoise(wp.xz * 0.04 + vec2(3.3, 1.1), uSeed + 86u), sfNoise(wp.xz * 0.04 + vec2(8.2, 6.7), uSeed + 87u));
  float pid; vec2 w1 = sfWorley(wq / 26.0 + vec2(1.3, 4.1), uSeed + 81u, pid);
  float pid2 = 0.5; vec2 w2 = vec2(1.0);
  if (dist < 125.0) w2 = sfWorley(wq / 6.8 + vec2(9.1, 2.3), uSeed + 85u, pid2);
  float widen = dist * 0.0006;
  float e1 = 1.0 - smoothstep(0.0, 0.0085 + widen / 26.0, w1.y);
  float e2 = (1.0 - smoothstep(0.0, 0.030 + widen / 6.8, w2.y)) * (1.0 - smoothstep(30.0, 120.0, dist));
  alb = mix(vec3(0.010, 0.014, 0.028), vec3(0.046, 0.052, 0.088), m2 * 0.55 + m3 * 0.25 + pid * 0.2) * (0.75 + 0.5 * pid2);
  alb *= 1.0 - 0.6 * (e1 + e2 * 0.6);
  rough = 0.16 + 0.26 * pid + 0.12 * m3;
  refl = 0.55;
  float vm = smoothstep(-0.30, 0.35, sfNoise(wp.xz * 0.009, uSeed + 84u));
  float pul = 0.62 + 0.38 * sin(uTime * 0.42 + m1 * 18.0 + pid * 12.0);
  vec3 cy = vec3(0.04, 0.60, 0.95), vi = vec3(0.50, 0.12, 1.0);
  vec3 vc = mix(cy, vi, smoothstep(0.35, 0.65, fract(pid * 3.7 + m1)));
  emis = vc * (e1 * (0.55 + 1.9 * vm) + e2 * 0.45 * pid2) * (0.7 + 0.8 * m3) * pul;
  // faint under-plate glow bleeding through the glass
  emis += vc * 0.012 * (0.5 + m2) * pul;
  // round glassy sparkles
  vec2 sp = wp.xz * 2.4; vec2 sc = floor(sp); vec2 sf = fract(sp) - 0.5; float shash = sfR(ivec2(sc), uSeed + 91u);
  float spOn = step(0.9955, shash) * smoothstep(0.16, 0.0, length(sf - vec2(sfR(ivec2(sc), uSeed + 93u) - 0.5, sfR(ivec2(sc), uSeed + 94u) - 0.5) * 0.4));
  emis += vec3(0.45, 0.8, 1.0) * spOn * (0.5 + 0.5 * sin(uTime * 2.0 + shash * 600.0)) * 3.5 * fade;
  vec4 d = sfDet(wp, uSeed + 93u, 0.6, fade), d2 = sfDet(wp, uSeed + 95u, 0.07, fade), dh = sfDetHi(wp, uSeed + 97u, fade * (1.0 - smoothstep(6.0, 22.0, dist)));
  bump = (d.yzw * 0.06 + d2.yzw * 0.26 + dh.yzw * 0.03) * fade;
}`,
};
