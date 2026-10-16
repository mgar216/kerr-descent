// Cocytus - frozen N2/H2O ice world, tidally locked to Erebus (body x axis = sub-Erebus point, z = north, lon east = +y).
// Surface look: pale blue-white ice shell scored by long lineae (baked small-circle arcs that start and stop, every third
// one a raised pressure ridge), swarms of parallel hairline crevasses, a multi-ring impact basin, polygonal convection
// cells on the frost plains around the glassy "Frozen Lake" (lat -18, lon 68), jumbled ice rafts in a chaos province,
// sparse craters, double-lipped crevasses with a faint blue subsurface glow (visible on the night side), dark geyser
// fans streaming from the vents of the Wailing Field (lat 30, lon 80), ragged dirty-ice maculae toward the Erebus-facing
// side and brilliant frost toward the night side. All linework is distance-estimated (constant width, clean
// anti-aliasing, widened toward the limb) and the relief normal comes from analytic gradients - no extra height samples.
// The palette is pre-compensated for the warm (1, .93, .80) light so the lit ice reads blue-white.
// uP0 = (seed, albedo, crack density, relief strength)   uP1 = (ice tint r,g,b, wind rotation [rad])
const D2R = Math.PI / 180;
const ll = (lat, lon) => { const c = Math.cos(lat * D2R); return [c * Math.cos(lon * D2R), c * Math.sin(lon * D2R), Math.sin(lat * D2R)]; };
const f5 = (x) => x.toFixed(5);
const vec3s = (a) => `vec3(${a.map(f5).join(', ')})`;
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// geyser vents: [lat, lon, fan length (rad)] — a cluster on the Wailing Field (30N, 80E) plus a few scattered ones
const VENTS = [
  [30, 80, 0.26], [34.5, 74, 0.22], [25.5, 85, 0.27], [37, 87.5, 0.21], [28.5, 91, 0.19], [22, 73.5, 0.24], [32.5, 67, 0.18],
  [12, 28, 0.17], [-30, 14, 0.16], [46, -22, 0.20], [-6, -44, 0.17], [20, -64, 0.16], [-52, 46, 0.18], [8, 112, 0.15],
];
const VENT_GLSL = VENTS.map(([la, lo, L]) => { const [x, y, z] = ll(la, lo); return `vec4(${f5(x)}, ${f5(y)}, ${f5(z)}, ${L.toFixed(3)})`; }).join(',\n  ');

// global lineae: small circles on the sphere. ARC = (axis xyz, cos of the angular radius); ARCP = (half width rad, activity-mask offset xyz)
const NMAJ = 8, NARC = 34;
const arcs = (() => {
  const r = rng(1120), A = [], P = [];
  for (let k = 0; k < NARC; k++) {
    const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    const major = k < NMAJ;
    const c = major ? (r() - 0.5) * 0.45 : (r() < 0.5 ? -1 : 1) * (0.25 + 0.65 * r());
    const hw = major ? 0.0028 + 0.0018 * r() : 0.0009 + 0.0009 * r();
    A.push(`vec4(${f5(s * Math.cos(a))}, ${f5(s * Math.sin(a))}, ${f5(z)}, ${f5(c)})`);
    P.push(`vec4(${f5(hw)}, ${f5(r() * 20)}, ${f5(r() * 20)}, ${f5(r() * 20)})`);
  }
  return { A: A.join(',\n  '), P: P.join(',\n  ') };
})();

export default {
  id: 'cocytus',
  defines: {},
  params: (look) => {
    const c = look.color ?? [0.55, 0.70, 0.85];
    return { uP0: [look.seed ?? 11.2, look.albedo ?? 0.72, 1.0, 1.0], uP1: [c[0] / 0.55, c[1] / 0.70, c[2] / 0.85, 1.05] };
  },
  glsl: /* glsl */ `
#define CX_NV ${VENTS.length}
#define CX_NA ${NARC}
#define CX_NMAJ ${NMAJ}
const vec3 CX_LAKE  = ${vec3s(ll(-18, 68))};
const vec3 CX_FIELD = ${vec3s(ll(30, 80))};
const vec3 CX_CHAOS = ${vec3s(ll(8, -38))};
const vec3 CX_BASIN = ${vec3s(ll(38, -12))};
const vec4 CX_V[CX_NV] = vec4[CX_NV](
  ${VENT_GLSL}
);
const vec4 CX_ARC[CX_NA] = vec4[CX_NA](
  ${arcs.A}
);
const vec4 CX_ARCP[CX_NA] = vec4[CX_NA](
  ${arcs.P}
);

mat3 cxJ;     // Jacobian of the domain warp (columns = gradients of the warp components)
vec3 cxP;     // current surface point
// fbmL with an early exit once the remaining octaves are finer than a pixel (same result, same normalisation - no contrast steps)
float cxFbm(vec3 p, int oct, float fp){
  float s = 0.0, a = 0.5, fr = 1.0;
  for (int i = 0; i < 5; i++){
    if (i >= oct) break;
    float w = 1.0 - smoothstep(0.35, 0.95, fr*fp);
    if (w <= 0.0) break;
    s += a*w*sn(p);
    p = M3*p*2.02 + vec3(1.7, 9.2, 4.1);
    a *= 0.5; fr *= 2.02;
  }
  return clamp(0.5 + 0.5*s/(1.0 - exp2(-float(oct))), 0.0, 1.0);
}

struct CxAcc { float core, lip, halo, wall, crest; vec3 h; };   // line-work accumulators + height gradient
CxAcc cxAcc(){ CxAcc a; a.core = 0.0; a.lip = 0.0; a.halo = 0.0; a.wall = 0.0; a.crest = 0.0; a.h = vec3(0.0); return a; }

// gradient noise with analytic gradient: x = sn(p), yzw = d sn / d p
vec4 cxNoise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u  = f*f*f*(f*(f*6.0 - 15.0) + 10.0);
  vec3 du = 30.0*f*f*(f*(f - 2.0) + 1.0);
  vec3 ga = h33(i)*2.0 - 1.0;
  vec3 gb = h33(i + vec3(1.0, 0.0, 0.0))*2.0 - 1.0;
  vec3 gc = h33(i + vec3(0.0, 1.0, 0.0))*2.0 - 1.0;
  vec3 gd = h33(i + vec3(1.0, 1.0, 0.0))*2.0 - 1.0;
  vec3 ge = h33(i + vec3(0.0, 0.0, 1.0))*2.0 - 1.0;
  vec3 gf = h33(i + vec3(1.0, 0.0, 1.0))*2.0 - 1.0;
  vec3 gg = h33(i + vec3(0.0, 1.0, 1.0))*2.0 - 1.0;
  vec3 gh = h33(i + vec3(1.0, 1.0, 1.0))*2.0 - 1.0;
  float va = dot(ga, f);
  float vb = dot(gb, f - vec3(1.0, 0.0, 0.0));
  float vc = dot(gc, f - vec3(0.0, 1.0, 0.0));
  float vd = dot(gd, f - vec3(1.0, 1.0, 0.0));
  float ve = dot(ge, f - vec3(0.0, 0.0, 1.0));
  float vf = dot(gf, f - vec3(1.0, 0.0, 1.0));
  float vg = dot(gg, f - vec3(0.0, 1.0, 1.0));
  float vh = dot(gh, f - vec3(1.0, 1.0, 1.0));
  float k1 = vb - va, k2 = vc - va, k4 = ve - va;
  float k3 = va - vb - vc + vd, k5 = va - vc - ve + vg, k6 = va - vb - ve + vf;
  float k7 = -va + vb + vc - vd + ve - vf - vg + vh;
  float v = va + k1*u.x + k2*u.y + k4*u.z + k3*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z;
  vec3 g = ga + u.x*(gb - ga) + u.y*(gc - ga) + u.z*(ge - ga)
         + u.x*u.y*(ga - gb - gc + gd) + u.y*u.z*(ga - gc - ge + gg) + u.z*u.x*(ga - gb - ge + gf)
         + (-ga + gb + gc - gd + ge - gf - gg + gh)*u.x*u.y*u.z
         + du*(vec3(k1, k2, k4) + u.yzx*vec3(k3, k5, k6) + u.zxy*vec3(k6, k3, k5) + u.yzx*u.zxy*k7);
  return 1.55*vec4(v, g);
}

// A line feature at distance d (rad) from its centre line, dir = unit tangent pointing away from it.
// Dark floor (core), translucent blue walls, bright lips, soft stain (halo); wall slope goes into a.h.
void cxLine(float d, vec3 dir, float hw, float vis, float lipA, float lod, inout CxAcc a){
  float hwv = hw*(0.35 + 0.65*vis);
  float he = max(hwv, 0.75*lod);
  float x = d/he;
  if (x > 16.0) return;
  float amp = (hwv/he)*smoothstep(0.0, 0.30, vis);
  float wide = smoothstep(1.2, 4.0, hwv/max(lod, 1e-6));      // translucent walls only show on cracks wider than a few pixels
  float u = (x - 2.8)/1.3;
  float lp = exp(-u*u);
  a.core = max(a.core, (1.0 - smoothstep(0.70, 1.15, x))*amp);
  a.wall = max(a.wall, exp(-(x - 1.25)*(x - 1.25)*6.0)*amp*wide);
  a.lip  = max(a.lip, lp*lipA*amp);
  a.halo = max(a.halo, exp(-x*x*0.012)*amp*lipA);
  float e = exp(-x*x);
  a.h += dir*((2.0*x*e - 0.7*lipA*(2.0*u/1.3)*lp)*0.55*amp);
}
// broad raised pressure ridge on a centre line (bright crest, no dark floor)
void cxRidgeLine(float d, vec3 dir, float hw, float vis, float lod, inout CxAcc a){
  float he = max(hw, 0.75*lod);
  float x = d/he;
  if (x > 8.0) return;
  float amp = (hw/he)*smoothstep(0.0, 0.30, vis);
  float e = exp(-x*x);
  a.crest = max(a.crest, e*amp);
  a.halo = max(a.halo, exp(-x*x*0.05)*amp*0.35);
  a.h += dir*((-2.0*x*e)*0.45*amp);
}
// periodic parallel crevasses: lines at integer values of dot(pa, axis)*S + off; some missing, broken into segments, widths varying
void cxSet(vec3 pa, vec3 axis, float S, float off, float hw, float vis, float lipA, float lod, inout CxAcc a){
  vis *= 1.0 - smoothstep(0.12, 0.35, lod*S);
  if (vis < 0.01) return;
  float ca = dot(cxP, axis);
  float sinT = sqrt(max(1.0 - ca*ca, 1e-4));
  vec3 tdir = (axis - cxP*ca)/sinT;
  float u0 = dot(pa, axis)*S + off;
  float u = u0 + 0.25*sin(u0*1.7 + off*3.0);                   // uneven spacing
  float n = floor(u), fu = u - n;
  float k = 1.0/(S*sinT);
  float lim = 16.0*max(hw*1.4, 0.75*lod);
  float d0 = fu*k, d1 = (1.0 - fu)*k;
  if (d0 < lim){
    float h0 = h11(n*7.31 + off);
    float v0 = vis*smoothstep(0.25, 0.50, h0)*smoothstep(-0.20, 0.30, sn(cxP*5.0 + vec3(n*1.37, off, n*0.71)));
    if (v0 > 0.01) cxLine(d0, tdir, hw*(0.6 + 0.8*h11(n*3.3 + 1.0)), v0, lipA, lod, a);
  }
  if (d1 < lim){
    float n1 = n + 1.0;
    float v1 = vis*smoothstep(0.25, 0.50, h11(n1*7.31 + off))*smoothstep(-0.20, 0.30, sn(cxP*5.0 + vec3(n1*1.37, off, n1*0.71)));
    if (v1 > 0.01) cxLine(d1, -tdir, hw*(0.6 + 0.8*h11(n1*3.3 + 1.0)), v1, lipA, lod, a);
  }
}

// nearest two feature points of a 3D cellular noise (vectors from the sample to the points)
void cxVor(vec3 x, out vec3 r1, out vec3 r2, out float id, out float idb){
  vec3 ip = floor(x), fp = fract(x);
  float d1 = 8.0, d2 = 8.0;
  r1 = vec3(0.0); r2 = vec3(0.0); id = 0.0; idb = 0.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 o = h33(ip + g);
    vec3 r = g + o - fp;
    float d = dot(r, r);
    if (d < d1){ d2 = d1; r2 = r1; idb = id; d1 = d; r1 = r; id = o.x; }
    else if (d < d2){ d2 = d; r2 = r; idb = o.x; }
  }
}

// sparse craters: one candidate per 3D lattice cell (the sphere slices a crater ball, so sizes vary for free)
void cxCraters(vec3 p, float S, float seed, float prob, float lod, inout CxAcc a, inout vec3 cr){   // cr = (bowl, rim, ejecta)
  if (0.30/S < 1.4*lod || prob < 0.01) return;
  vec3 x = p*S + seed;
  vec3 i = floor(x);
  if (h13(i + 7.7) > prob) return;
  vec3 cc = i + 0.30 + 0.40*h33(i + 1.3);
  float R = 0.10 + 0.17*h13(i + 3.1);
  vec3 dv = x - cc;
  float d3 = length(dv);
  float t = d3/R;
  if (t > 1.8) return;
  float fade = smoothstep(1.2, 3.0, (R/S)/max(lod, 1e-5));
  float u = (t - 1.05)/0.20;
  float re = exp(-u*u);
  float bowl = t < 1.0 ? 1.0 - t*t : 0.0;
  float ej = t > 1.0 ? exp(-(t - 1.0)*2.8)*(1.0 - smoothstep(1.15, 1.75, t)) : 0.0;
  cr = max(cr, fade*vec3(bowl, re, ej));
  float dP = (t < 1.0 ? 2.0*t : 0.0) - 4.5*u*re;
  a.h += (dv/max(d3, 1e-4))*(0.22*dP*fade);
}

// dark geyser fan: soot streaks blown downwind of a vent (x = deposit, y = bright rim of the vent pit)
vec2 cxFan(vec3 p, vec3 c, float L, float k, float sd, vec3 sunB, float lod){
  float cs = dot(p, c);
  float r2 = 2.0*(1.0 - cs);
  if (r2 > L*L) return vec2(0.0);
  float sv = h11(k*3.91 + sd);
  float r = sqrt(max(r2, 1e-10));
  vec3 d = p - c*cs;
  vec3 tw = sunB - c*dot(c, sunB);
  float tl = length(tw);
  tw = tl > 1e-3 ? tw/tl : normalize(cross(c, vec3(0.0, 0.0, 1.0)));      // toward the sun
  float wr = uP1.w + (sv - 0.5)*0.6;
  vec3 w = tw*cos(wr) + cross(c, tw)*sin(wr);
  float al = dot(d, w), ac = dot(d, cross(c, w));
  float th = atan(ac, al + 1e-6) + (0.35 + 0.8*sv)*(r/L);                    // streaks curve with distance
  const float F1 = 7.0;
  float st = sn(vec3(th*F1 + sv*40.0, r*3.0/L + sv*3.0, sv*17.0));
  float stk = smoothstep(-0.05, 0.45, st);
  stk = mix(0.45, stk, 1.0 - smoothstep(0.30, 0.90, F1*lod/max(r, 1e-4)));
  float et = exp(-th*th/0.30);
  float er = 1.0 - smoothstep(0.5*L, L, r);
  float dep = er*et*(0.45 + 0.55*stk) + 0.9*exp(-r2/(0.0036*L*L));
  float q = (r - 0.04*L)/(0.015*L);
  return vec2(clamp(dep, 0.0, 1.0), exp(-q*q)*0.5);
}

Surf surfaceAt(vec3 p, vec3 sunB, float lod){
  Surf s = surfDefault(p);
  float sd = uP0.x, crackK = uP0.z, reliefK = uP0.w;
  float mu = dot(p, sunB);
  bool hq = uQuality > 0.5;                                       // the fast harness skips the finest detail layers
  cxP = p;
  {   // the pixel footprint stretches by 1/cos toward the limb: widen the filter there (view ray rebuilt from the camera uniforms)
    vec3 N0 = p.x*uAx + p.y*uAy + p.z*uAz;
    lod /= sqrt(clamp(-dot(N0, normalize(uC + N0)), 0.12, 1.0));
  }

  // domain warp; its three values double as low-frequency "activity" masks
  vec3 q0 = p*1.55 + vec3(sd*1.37, sd*0.71, -sd*0.43);
  vec4 wx = cxNoise(q0 + 3.0), wy = cxNoise(q0 + 17.0), wz = cxNoise(q0 + 31.0);
  cxJ = mat3(wx.yzw, wy.yzw, wz.yzw)*(0.075*1.55);
  vec3 pw = p + 0.075*vec3(wx.x, wy.x, wz.x);

  // provinces: the Frozen Lake basin, the frost plain around it, the Wailing Field, a chaos province, smooth plains elsewhere
  float reg = fbmL(pw*1.15 + vec3(sd*0.33, 4.0, 9.0), 3, lod*1.15);
  float cL = clamp(dot(p, CX_LAKE), -1.0, 1.0);
  float dL = acos(cL) + 0.030*wx.x;
  float dF = acos(clamp(dot(p, CX_FIELD), -1.0, 1.0)) + 0.040*wy.x;
  float dC = acos(clamp(dot(p, CX_CHAOS), -1.0, 1.0)) + 0.050*wz.x;
  float lakeM  = 1.0 - smoothstep(0.110, 0.150, dL);
  float planM  = 1.0 - smoothstep(0.20, 0.42, dL);
  float fieldM = 1.0 - smoothstep(0.17, 0.36, dF);
  float chaosM = 1.0 - smoothstep(0.16, 0.34, dC);
  float plainM = max(max(planM*0.85, fieldM*0.65), smoothstep(0.50, 0.64, reg))*(1.0 - 0.8*chaosM);
  float cB = clamp(dot(p, CX_BASIN), -1.0, 1.0);
  float dB = acos(cB) + 0.010*wy.x;
  float basinM = 1.0 - smoothstep(0.075, 0.095, dB);                // bright palimpsest floor of the multi-ring basin
  plainM = max(plainM, 0.8*basinM);
  float cr = crackK*(1.0 - 0.80*plainM)*(1.0 - lakeM);

  CxAcc a = cxAcc();

  // long lineae: arcs of small circles, broken into segments by a low-frequency mask
  {
    vec3 pa = p + 0.045*vec3(wx.x, wy.x, wz.x);
    float crA = crackK*(1.0 - 0.45*plainM)*(1.0 - 0.95*lakeM);
    for (int k = 0; k < CX_NA; k++){
      vec4 A = CX_ARC[k], B = CX_ARCP[k];
      float dpa = dot(pa, A.xyz);
      float dp = dpa - A.w;
      float sinT = sqrt(max(1.0 - dpa*dpa, 1e-4));
      float d = abs(dp)/sinT;
      if (d > 16.0*max(B.x, 0.75*lod)) continue;
      float m = sn(p*(k < CX_NMAJ ? 1.9 : 3.4) + B.yzw);
      float vis = crA*smoothstep(-0.10, 0.40, m);
      if (vis < 0.01) continue;
      vec3 dir = (A.xyz - p*dot(p, A.xyz))*(sign(dp)/sinT);
      float fj = 0.14/B.x;                                         // ragged walls
      float dj = d + 0.5*B.x*sn(p*fj + B.yzw)*(1.0 - smoothstep(0.3, 0.8, lod*fj));
      if (k >= CX_NMAJ && k % 3 == 0) cxRidgeLine(max(dj, 0.0), dir, B.x*2.6, vis, lod, a);       // every third minor arc is a pressure ridge
      else cxLine(max(dj, 0.0), dir, B.x, vis, 1.0, lod, a);
    }
  }

  // parallel crevasse swarms in patches (conjugate sets cross where patches overlap)
  {
    vec3 pa = p + 0.090*vec3(wx.x, wy.x, wz.x);
    float m1 = 0.7*wx.x - 0.5*wy.x, m2 = 0.6*wy.x + 0.5*wz.x, m3 = 0.6*wz.x - 0.6*wx.x;
    cxSet(pa, normalize(vec3(0.31, -0.62, 0.72)), 22.0, sd, 0.0007, cr*smoothstep(0.02, 0.30, m1), 0.9, lod, a);
    cxSet(pa, normalize(vec3(-0.80, 0.20, 0.56)), 57.0, sd*1.7, 0.00033, cr*smoothstep(0.0, 0.28, m2), 0.8, lod, a);
    if (lod < 0.004) cxSet(pa, normalize(vec3(0.10, 0.90, 0.42)), 140.0, sd*2.3, 0.00018, cr*smoothstep(-0.05, 0.25, m3), 0.7, lod, a);
  }

  // frozen-lake shore ridge
  {
    float x0 = dL - 0.138;
    vec3 away = (p*cL - CX_LAKE)/max(sqrt(1.0 - cL*cL), 1e-3);
    CxAcc sa = cxAcc();
    cxLine(abs(x0), away*sign(x0), 0.0045*(0.8 + 0.4*wz.x), 1.0, 1.0, lod, sa);
    a.lip = max(a.lip, sa.lip*0.9); a.halo = max(a.halo, sa.halo*0.6); a.core = max(a.core, sa.core*0.5); a.wall = max(a.wall, sa.wall*0.5);
    a.h += sa.h;
  }

  // multi-ring basin: ring scarps at radii 0.07 * 1.35^n, broken into arcs
  if (dB > 0.085 && dB < 0.46){
    float rr = log(dB/0.07)*3.3322;
    float fb = fract(rr);
    float dring = min(fb, 1.0 - fb)*0.3001*dB;
    float hwB = 0.0028 + 0.012*dB;
    if (dring < 16.0*max(hwB, 0.75*lod)){
      float sinB = max(sqrt(1.0 - cB*cB), 1e-3);
      vec3 awayB = (p*cB - CX_BASIN)/sinB;
      float rm = sn(p*3.0 + vec3(floor(rr)*1.7, sd, 9.0));
      float vB = crackK*smoothstep(-0.20, 0.30, rm)*smoothstep(0.085, 0.12, dB)*(1.0 - smoothstep(0.34, 0.46, dB));
      cxLine(dring, awayB*(fb < 0.5 ? 1.0 : -1.0), hwB, vB, 1.0, lod, a);
    }
  }

  // polygonal cells: convection cells on the frost plains, ice rafts in the chaos province
  float cellU = (1.0 - plainM)*(1.0 - chaosM)*smoothstep(0.0, 0.45, 0.7*wy.x - 0.5*wz.x + 0.1)*0.6;   // fine craquelure patches on the uplands
  float cellW = max(max(planM*0.9, 0.18*plainM), max(chaosM, cellU))*(1.0 - 0.85*lakeM);
  float cellCore = 0.0, cellId = 0.5;
  if (cellW > 0.02){
    float CF = mix(mix(60.0, 14.0, smoothstep(0.1, 0.5, planM)), 34.0, smoothstep(0.2, 0.7, chaosM));
    if (lod*CF < 0.40){
      vec3 r1, r2; float id, idb;
      vec4 jn = cxNoise(pw*CF*0.55 + 3.0);                            // edges meander a little
      cxVor(pw*CF + 13.0 + jn.yzw*0.09, r1, r2, id, idb);
      vec3 d12 = r1 - r2;
      float l12 = max(length(d12), 1e-3);
      float dE = (dot(r2, r2) - dot(r1, r1))/(2.0*l12)/CF;
      vec3 dirT = d12/l12; dirT -= p*dot(dirT, p);
      float tl = max(length(dirT), 0.35);
      CxAcc ca = cxAcc();
      float eh = h11(id*91.7 + idb*91.7 + id*idb*53.1);               // per-edge hash: some troughs bold, some hairline
      float fadeC = 1.0 - smoothstep(0.20, 0.40, lod*CF);
      float hwC = (0.014 + 0.050*chaosM)/CF*(0.55 + 0.9*eh);
      cxLine(dE/tl, dirT/tl, hwC, cellW*(0.35 + 0.65*smoothstep(0.05, 0.75, eh))*fadeC, 0.6, lod, ca);
      cellCore = ca.core;
      a.lip = max(a.lip, ca.lip*0.6); a.wall = max(a.wall, ca.wall*0.4);
      a.h += ca.h*0.8;
      vec3 rr = r1 - p*dot(r1, p);                                   // dome / tilted raft
      a.h += rr*(0.10*fadeC*(1.0 - chaosM)*cellW);
      vec3 tv = h33(vec3(id, id*2.31, id*5.17)*17.0) - 0.5;
      a.h += tv*(0.55*chaosM*fadeC);
      cellId = id;
    }
  }

  // craters (sparser on the resurfaced plains, none on the lake)
  vec3 crt = vec3(0.0);
  float crP = (1.0 - 0.85*plainM)*(1.0 - lakeM);
  cxCraters(p, 9.0,   sd + 3.0, 0.45*crP, lod, a, crt);
  cxCraters(p, 30.0,  sd + 8.0, 0.30*crP, lod, a, crt);
  cxCraters(p, 100.0, sd + 5.0, 0.22*crP, lod, a, crt);

  // gentle undulation + glitter micro-relief; noise stretched along the sun axis -> wind-combed streaks radiating from the sub-Erebus point
  vec3 pS = vec3(pw.x*0.22, pw.y, pw.z);
  vec4 u1 = cxNoise(pS*14.0 + 5.0 + sd);
  vec3 gu = u1.yzw*vec3(0.22*14.0, 14.0, 14.0); gu += cxJ*gu;
  a.h += gu*(0.0045*(1.0 - 0.85*plainM));
  if (hq && lod < 0.006){
    vec4 u2 = cxNoise(pS*33.0 + 9.0);
    vec3 gv = u2.yzw*vec3(0.22*33.0, 33.0, 33.0); gv += cxJ*gv;
    a.h += gv*(0.0016*(1.0 - 0.85*plainM));
  }
  if (hq && lod < 0.0016){
    vec4 gr = cxNoise(pw*540.0 + 11.0);
    a.h += gr.yzw*(540.0*1.1e-4*(1.0 - smoothstep(0.25, 0.70, lod*540.0))*(0.4 + 0.6*plainM));
  }
  if (hq && lod < 0.0006){
    vec4 gq = cxNoise(pw*1500.0 + 17.0);
    a.h += gq.yzw*(1500.0*3.0e-5*(1.0 - smoothstep(0.25, 0.70, lod*1500.0))*(0.4 + 0.6*plainM));
  }

  // geyser fans
  float dep = 0.0, ventRim = 0.0;
  for (int k = 0; k < CX_NV; k++){
    vec4 v = CX_V[k];
    vec2 fv = cxFan(p, v.xyz, v.w, float(k), sd, sunB, lod);
    dep = max(dep, fv.x); ventRim = max(ventRim, fv.y);
  }

  // colour - the palette is pre-compensated for the warm (1, .93, .80) light so the lit ice reads pale blue-white
  float warm = smoothstep(-0.10, 0.85, mu);
  float cold = 1.0 - smoothstep(-0.60, 0.15, mu);
  float polar = smoothstep(0.60, 0.90, abs(p.z) + 0.10*wx.x);
  float mott  = cxFbm(pS*12.0 + 7.0, 3, lod*12.0);                  // frost mottling
  float dirtN = cxFbm(pS*1.9 + 31.0, 3, lod*1.9);                   // large ragged maculae of dirty ice
  float mott2 = cxFbm(pS*39.0 + 3.0, 3, lod*39.0);
  float grain = hq ? cxFbm(pS*200.0 + 21.0, 2, lod*200.0) : 0.5;
  vec3 tint   = uP1.xyz*(uP0.y/0.72);
  vec3 iceB   = vec3(0.24, 0.50, 0.98)*tint;      // pale blue ice
  vec3 frost  = vec3(0.50, 0.68, 1.00)*tint;      // brilliant frost (neutral white under the warm light)
  vec3 clearB = vec3(0.13, 0.34, 0.92)*tint;      // clear blue ice
  vec3 dirtC  = vec3(0.30, 0.31, 0.38)*tint;      // dirty ice (warm grey-brown under the warm light)
  vec3 lakeC  = mix(vec3(0.11, 0.34, 0.86), vec3(0.03, 0.15, 0.56), 1.0 - smoothstep(0.0, 0.14, dL));
  vec3 sootC  = vec3(0.048, 0.040, 0.042);
  vec3 crackC = vec3(0.004, 0.016, 0.075);
  vec3 wallC  = vec3(0.03, 0.17, 0.50);

  float fr = smoothstep(0.05, 0.95, 0.40 + 0.55*cold + 0.55*polar + 0.30*(1.0 - plainM) + 0.45*basinM + 1.1*(mott - 0.5));
  vec3 alb = mix(iceB, frost, fr);
  alb = mix(alb, clearB, plainM*0.22*(1.0 - 0.5*fr));
  float dn = dirtN + 0.20*(mu - 0.35) - 0.06*plainM + 0.14*(mott - 0.5);
  float dirt = warm*smoothstep(0.61, 0.67, dn)*(1.0 - lakeM)*(0.70 + 0.60*mott2);
  alb *= 1.0 - 0.10*smoothstep(0.53, 0.64, dn)*warm;          // dusty fringe
  alb *= 1.0 - 0.36*fieldM*(0.5 + 0.5*mott2);                 // soot haze over the Wailing Field
  alb = mix(alb, dirtC, dirt*0.65);
  alb = mix(alb, lakeC*(0.92 + 0.16*mott2), lakeM*0.9);
  alb *= (0.86 + 0.28*mott2)*(0.93 + 0.14*grain);
  // chaos rafts: each block its own tone
  float rafts = chaosM*smoothstep(0.15, 0.7, 1.0 - cellCore);
  vec3 rc = mix(clearB, frost, h11(cellId*61.0 + 3.0))*(0.78 + 0.34*h11(cellId*17.0 + 9.0));
  alb = mix(alb, rc, rafts*0.75);
  alb *= mix(1.0, 0.93 + 0.12*cellId, cellW);
  // craters
  alb = mix(alb, alb*vec3(0.85, 0.90, 0.97), crt.x*0.25);
  alb = mix(alb, frost, clamp(crt.y*0.16 + crt.z*0.28, 0.0, 0.5));
  // linework
  alb *= 1.0 - 0.30*a.halo;
  alb = mix(alb, frost, a.crest*0.55);
  alb = mix(alb, frost, a.lip*0.50);
  alb = mix(alb, wallC, a.wall*0.70);
  alb = mix(alb, vec3(0.06, 0.14, 0.30), cellCore*(0.40 + 0.45*chaosM));
  alb = mix(alb, crackC, a.core*0.96);
  alb = mix(alb, frost, ventRim*(1.0 - dep*0.6));
  alb = mix(alb, sootC, dep*0.92);
  s.albedo = alb;

  float glow = (0.30 + 0.70*cold)*(0.55 + 0.45*smoothstep(-0.35, 0.45, 0.6*wy.x - 0.5*wz.x + 0.3*wx.x));
  s.emit = (vec3(0.008, 0.060, 0.22)*a.core + vec3(0.0, 0.050, 0.17)*a.wall + vec3(0.0, 0.014, 0.050)*a.halo)*glow;
  s.spec = mix(0.35, 0.80, plainM)*(1.0 - 0.55*fr*(1.0 - plainM)) + 0.25*lakeM;
  s.spec = mix(s.spec, 0.7, a.core)*(1.0 - 0.7*dep);
  s.rough = mix(0.32, 0.13, plainM)*(1.0 - 0.60*lakeM) + 0.15*fr*(1.0 - plainM) + 0.30*dirt;
  s.rough = mix(s.rough, 0.12, a.core);

  float relief = reliefK*(1.0 - smoothstep(0.012, 0.030, lod));
  s.nrm = perturb(p, a.h*relief);
  return s;
}
`,
};
