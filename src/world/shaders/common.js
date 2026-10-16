// ORPHEUS — shared GLSL for the far-pass worlds.
//
// Every world is drawn as ONE screen-aligned quad whose fragment shader ray-traces (analytically) a unit sphere
// (surface), an optional cloud shell, an exponential single-scattering atmosphere, and an optional flat ring system.
// Unit of length in the shader = the body radius. Camera at the origin looking down −Z (three.js camera space).
//
// A body module supplies (see the Asphodel module for a worked example):
//     Surf surfaceAt(vec3 p, vec3 sunB, float lod);      // p: unit vector in the BODY-FIXED frame
//   optionally   #define HAS_CLOUDS  →  vec4 cloudsAt(vec3 p, vec3 sunB, float lod);   // rgb albedo, a opacity
//                #define HAS_RINGS   →  vec4 ringAt(float r, float pixW);               // rgb albedo, a optical depth τ
// `lod` = angular footprint of one pixel on the unit sphere (radians). Feed `fbmL(p*f, oct, lod*f)`.
// Free per-body parameters: uP0..uP3 (vec4), uTime (coordinate seconds).

export const NOISE_GLSL = /* glsl */ `
float h11(float p){ p = fract(p*0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h13(vec3 p3){ p3 = fract(p3*0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y)*p3.z); }
vec3  h33(vec3 p3){ p3 = fract(p3*vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx)*p3.zyx); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }

// gradient noise, ≈ [-1,1]
float sn(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p);
  vec3 u = f*f*f*(f*(f*6.0 - 15.0) + 10.0);
  float n000 = dot(h33(i)*2.0 - 1.0, f);
  float n100 = dot(h33(i + vec3(1.,0.,0.))*2.0 - 1.0, f - vec3(1.,0.,0.));
  float n010 = dot(h33(i + vec3(0.,1.,0.))*2.0 - 1.0, f - vec3(0.,1.,0.));
  float n110 = dot(h33(i + vec3(1.,1.,0.))*2.0 - 1.0, f - vec3(1.,1.,0.));
  float n001 = dot(h33(i + vec3(0.,0.,1.))*2.0 - 1.0, f - vec3(0.,0.,1.));
  float n101 = dot(h33(i + vec3(1.,0.,1.))*2.0 - 1.0, f - vec3(1.,0.,1.));
  float n011 = dot(h33(i + vec3(0.,1.,1.))*2.0 - 1.0, f - vec3(0.,1.,1.));
  float n111 = dot(h33(i + vec3(1.,1.,1.))*2.0 - 1.0, f - vec3(1.,1.,1.));
  return 1.55*mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
const mat3 M3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
// fractal noise in [0,1]; fp = footprint of one pixel in units of p (octaves finer than a pixel fade out)
float fbmL(vec3 p, int oct, float fp){
  float s = 0.0, a = 0.5, n = 0.0, fr = 1.0;
  for (int i = 0; i < 12; i++){
    if (i >= oct) break;
    float w = 1.0 - smoothstep(0.35, 0.95, fr*fp);
    s += a*w*sn(p); n += a;
    p = M3*p*2.02 + vec3(1.7, 9.2, 4.1);
    a *= 0.5; fr *= 2.02;
  }
  return clamp(0.5 + 0.5*s/n, 0.0, 1.0);
}
// ridged multifractal in [0,1] (sharp crests) – good for ranges, crevasses, rivers
float ridgedL(vec3 p, int oct, float fp){
  float s = 0.0, a = 0.5, n = 0.0, fr = 1.0, prev = 1.0;
  for (int i = 0; i < 10; i++){
    if (i >= oct) break;
    float w = 1.0 - smoothstep(0.35, 0.95, fr*fp);
    float r = 1.0 - abs(sn(p)); r *= r;
    s += a*w*r*prev; n += a; prev = clamp(r*1.6, 0.0, 1.0);
    p = M3*p*2.03 + vec3(3.3, 1.1, 7.7);
    a *= 0.5; fr *= 2.03;
  }
  return clamp(s/n, 0.0, 1.0);
}
// cellular noise: (F1, F2, cell hash)
vec3 vor3(vec3 p){
  vec3 ip = floor(p), fp = fract(p);
  float f1 = 8.0, f2 = 8.0, id = 0.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 o = h33(ip + g);
    vec3 r = g + o - fp;
    float d = dot(r, r);
    if (d < f1){ f2 = f1; f1 = d; id = h13(ip + g); } else if (d < f2){ f2 = d; }
  }
  return vec3(sqrt(f1), sqrt(f2), id);
}
mat3 rotAxis(vec3 a, float ang){
  float c = cos(ang), s = sin(ang), t = 1.0 - c;
  return mat3(t*a.x*a.x + c,     t*a.x*a.y + s*a.z, t*a.x*a.z - s*a.y,
              t*a.x*a.y - s*a.z, t*a.y*a.y + c,     t*a.y*a.z + s*a.x,
              t*a.x*a.z + s*a.y, t*a.y*a.z - s*a.x, t*a.z*a.z + c);
}
// tilts a unit normal n by the (3D) height-field gradient g
vec3 perturb(vec3 n, vec3 g){ return normalize(n - (g - n*dot(g, n))); }
`;

export const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec4 uRect;
varying vec2 vNdc;
void main(){
  vec2 ndc = mix(uRect.xy, uRect.zw, position.xy*0.5 + 0.5);
  vNdc = ndc;
  gl_Position = vec4(ndc, 0.0, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const HEADER = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform float uTanHalf, uAspect, uPixAng;
uniform vec3  uC;                 // body centre in camera space (body radii)
uniform vec3  uAx, uAy, uAz;      // body-fixed axes in camera space
uniform vec3  uSun;               // unit vector body → light source (camera space)
uniform vec3  uSunRad;            // radiance of a white face-on surface, light colour & exposure included
uniform float uSunSoft;           // angular radius of the light source (rad) → soft terminator
uniform vec3  uAmb;               // night-side ambient (display units)
uniform vec3  uBeta;              // atmosphere: Rayleigh-like scattering (per body radius at the surface)
uniform float uBetaMie, uHs, uAtmoTop;   // haze coefficient, scale height, shell height (body radii)
uniform float uEmit;              // multiplier for emissive terms
uniform float uTime;
uniform float uDistScale;         // metres-of-M per body radius along the ray (occlusion path length)
uniform float uBhOn;
uniform sampler2D uBhTex;
uniform vec3  uRingN;             // ring normal (camera space)
uniform vec2  uRingR;             // ring inner/outer radius (body radii)
uniform vec3  uParentDir;         // direction toward the parent planet (moons)
uniform vec3  uParentRad;         // light from the parent (white-surface radiance)
uniform vec4  uP0, uP1, uP2, uP3; // body-specific parameters
uniform float uQuality;           // 0 = fast harness, 1 = full
uniform float uFade;              // 0..1 crossfade against the point sprite
varying vec2 vNdc;
#define PI 3.14159265359
struct Surf { vec3 albedo; vec3 emit; vec3 nrm; float rough; float spec; };
Surf surfDefault(vec3 p){ Surf s; s.albedo = vec3(0.5); s.emit = vec3(0.0); s.nrm = p; s.rough = 0.8; s.spec = 0.0; return s; }
float muEff(float m, float s){ return 0.5*(m + sqrt(m*m + s*s)); }
float airmass(float mu){
  float z = min(degrees(acos(clamp(mu, 0.0, 1.0))), 95.5);
  return 1.0/(max(mu, 0.0) + 0.50572*pow(96.07995 - z, -1.6364));
}
`;

const CORE = /* glsl */ `
#ifndef ATMO_STEPS
#define ATMO_STEPS 10
#endif
#ifndef RING_OUT
#define RING_OUT 1.0
#endif

void atmoSample(vec3 rd, float t, float ds, inout vec3 sum, inout vec3 Tv){
  vec3 q = rd*t - uC;
  float rq = length(q);
  float alt = max(rq - 1.0, 0.0);
  float rho = exp(-alt/uHs);
  float rhoM = exp(-alt/(uHs*0.45));
  float mu = dot(q/rq, uSun);
  float muh = -sqrt(max(1.0 - 1.0/(rq*rq), 0.0));
  float lit = smoothstep(muh - uSunSoft, muh + uSunSoft + 0.003, mu);
  vec3 ext = uBeta*rho + vec3(uBetaMie*1.1*rhoM);
  vec3 stepT = exp(-ext*ds);
  vec3 sunT = exp(-(uBeta*rho + vec3(uBetaMie*1.1*rhoM*0.45))*uHs*airmass(mu));
  float cg = dot(rd, uSun);
  float pr = 0.0596831*(1.0 + cg*cg);
  const float G = 0.74;
  float pm = 0.0795775*(1.0 - G*G)/pow(1.0 + G*G - 2.0*G*cg, 1.5);
  vec3 scat = uBeta*rho*pr + vec3(uBetaMie*rhoM*pm);
  sum += Tv*(1.0 - stepT)/max(ext, vec3(1e-5))*(lit*sunT)*scat;
  Tv *= stepT;
}
// in-scattered radiance (excl. light intensity) over [t0,t1]; Tv receives the view transmittance
vec3 marchAtmo(vec3 rd, float t0, float t1, float tc, out vec3 Tv){
  vec3 sum = vec3(0.0); Tv = vec3(1.0);
  tc = clamp(tc, t0, t1);
  const int N = ATMO_STEPS/2;
  float L0 = tc - t0, L1 = t1 - tc;
  float prev = 0.0;
  for (int k = 0; k < N; k++){            // camera side → closest approach, dense near the end
    float s1 = (float(k) + 1.0)/float(N);
    float f1 = 1.0 - (1.0 - s1)*(1.0 - s1);
    float ta = t0 + L0*prev, tb = t0 + L0*f1;
    atmoSample(rd, 0.5*(ta + tb), tb - ta, sum, Tv);
    prev = f1;
  }
  prev = 0.0;
  for (int k = 0; k < N; k++){            // closest approach → far side, dense at the start
    float s1 = (float(k) + 1.0)/float(N);
    float f1 = s1*s1;
    float ta = tc + L1*prev, tb = tc + L1*f1;
    atmoSample(rd, 0.5*(ta + tb), tb - ta, sum, Tv);
    prev = f1;
  }
  return sum;
}

float ringShadowAt(vec3 Pw){    // optical transmittance of the ring system along the light path from a point (camera space)
#ifdef HAS_RINGS
  float dn = dot(uSun, uRingN);
  if (abs(dn) < 1e-4) return 1.0;
  float ts = dot(uC - Pw, uRingN)/dn;
  if (ts <= 0.0) return 1.0;
  vec3 Q = Pw + uSun*ts - uC;
  float rr = length(Q);
  if (rr < uRingR.x || rr > uRingR.y) return 1.0;
  float pw = uPixAng*max(length(Pw), 1.0)*3.0;
  float tau = ringAt(rr, pw).a;
  return exp(-tau/max(abs(dn), 0.02));
#else
  return 1.0;
#endif
}

float hg(float cg, float g){ return 0.0795775*(1.0 - g*g)/pow(1.0 + g*g - 2.0*g*cg, 1.5); }

void main(){
  vec3 rd = normalize(vec3(vNdc.x*uTanHalf*uAspect, vNdc.y*uTanHalf, -1.0));
  float Dc = length(uC);
  float b = dot(uC, rd);
  vec3 cp = rd*b - uC;                     // centre → closest point on the ray
  float dmin = length(cp);
  float pix = uPixAng*max(b, 0.25);
  float topR = 1.0 + uAtmoTop;
  float bound = max(topR, RING_OUT);
  if (dmin > bound + 3.0*pix) discard;

  // ── planet sphere ───────────────────────────────────────────────
  float hP = 1.0 - dmin*dmin;
  bool hitP = hP > 0.0 && b > 0.0;
  float tp = hitP ? b - sqrt(hP) : 0.0;
  float cov = clamp((1.0 - dmin)/pix + 0.5, 0.0, 1.0);
  bool planet = hitP || (cov > 0.0 && b > 0.0);
  if (hitP && tp < 0.0) { hitP = false; planet = false; cov = 0.0; }

  // ── atmosphere shell segment ────────────────────────────────────
  float hA = topR*topR - dmin*dmin;
  bool inA = hA > 0.0 && uAtmoTop > 0.0;
  float ta0 = 0.0, ta1 = 0.0;
  if (inA){
    float sq = sqrt(hA);
    ta0 = max(b - sq, 0.0); ta1 = b + sq;
    if (ta1 <= 0.0) inA = false;
  }
  float tEnd = hitP ? tp : ta1;

  vec3 colL = vec3(0.0); float aL = 0.0;       // solid layer (premultiplied)
  vec3 sunB = vec3(dot(uSun, uAx), dot(uSun, uAy), dot(uSun, uAz));

  if (planet){
    vec3 N0 = hitP ? normalize(rd*tp - uC) : cp/max(dmin, 1e-5);
    vec3 Pw = hitP ? rd*tp : uC + N0;
    vec3 pb = vec3(dot(N0, uAx), dot(N0, uAy), dot(N0, uAz));
    float lod = uPixAng*max(hitP ? tp : b, 0.05);
    Surf S = surfaceAt(pb, sunB, lod);
    vec3 Nb = dot(S.nrm, S.nrm) > 0.25 ? normalize(S.nrm) : pb;
    vec3 Nc = Nb.x*uAx + Nb.y*uAy + Nb.z*uAz;
    float mu0 = dot(N0, uSun);
    float mu = dot(Nc, uSun);
    float soft = uSunSoft;
    float horizon = smoothstep(-soft, soft*2.0 + 0.01, mu0);
    float diff = muEff(mu, soft*0.6)*horizon;
    vec3 sunT = vec3(1.0);
    if (uAtmoTop > 0.0) sunT = exp(-(uBeta + vec3(uBetaMie*0.5))*uHs*airmass(mu0));
    float shadow = 1.0;
#ifdef HAS_CLOUDS
    {   // cloud shadow: look up the cloud layer displaced along the light
      vec3 hz = sunB - pb*dot(pb, sunB);
      float cs = max(dot(pb, sunB), 0.12);
      vec3 ps = normalize(pb - hz*(CLOUD_H/cs));
      shadow *= 1.0 - 0.72*cloudCover(ps, sunB, lod*4.0);
    }
#endif
    shadow *= ringShadowAt(Pw);
    vec3 col = S.albedo*(uSunRad*sunT*diff*shadow);
    // sky-light fill + night ambient + parent-planet shine
    vec3 skyFill = uAtmoTop > 0.0 ? uSunRad*uBeta/max(uBeta.b, 1e-3)*0.06*(0.35 + 0.65*mu0)*horizon*shadow : vec3(0.0);
    col += S.albedo*(uAmb + skyFill);
    col += S.albedo*uParentRad*max(dot(Nc, uParentDir), 0.0)*(0.25 + 0.75*step(0.0, dot(N0, uParentDir)));
    // specular glint of the (extended) light source
    if (S.spec > 0.0){
      vec3 V = -rd;
      vec3 H = normalize(uSun + V);
      float NH = max(dot(Nc, H), 0.0), NV = max(dot(Nc, V), 0.04);
      float a = max(S.rough, 0.03);
      float a2 = a*a + soft*soft*0.25;
      float dd = NH*NH*(a2 - 1.0) + 1.0;
      float D = a2/(PI*dd*dd);
      float F = 0.02 + 0.98*pow(1.0 - max(dot(H, V), 0.0), 5.0);
      col += uSunRad*sunT*S.spec*PI*D*F/(4.0*NV)*horizon*shadow*step(0.0, mu0 + soft);
    }
    col += S.emit*uEmit;
    colL = col*cov; aL = cov;
  }

#ifdef HAS_CLOUDS
  {
    float Rc = 1.0 + CLOUD_H;
    float hC = Rc*Rc - dmin*dmin;
    if (hC > 0.0 && b > 0.0){
      float tc0 = b - sqrt(hC);
      if (tc0 > 0.0 && (!hitP || tc0 < tp)){
        vec3 nc = normalize(rd*tc0 - uC);
        vec3 pcb = vec3(dot(nc, uAx), dot(nc, uAy), dot(nc, uAz));
        float lodc = uPixAng*max(tc0, 0.05);
        vec4 cl = cloudsAt(pcb, sunB, lodc);
        float muc = dot(nc, uSun);
        float hzc = smoothstep(-uSunSoft, uSunSoft*2.0 + 0.01, muc);
        vec3 sunTc = exp(-(uBeta + vec3(uBetaMie*0.5))*uHs*airmass(muc));
        vec3 lc = cl.rgb*(uSunRad*sunTc*muEff(muc, uSunSoft*0.6)*hzc + uAmb + uSunRad*0.05*hzc*uBeta/max(uBeta.b, 1e-3));
        float ca = cl.a;
        if (!hitP) ca *= clamp((Rc - dmin)/pix, 0.0, 1.0);
        colL = lc*ca + colL*(1.0 - ca);
        aL = ca + aL*(1.0 - ca);
      }
    }
  }
#endif

  // ── atmosphere on top ───────────────────────────────────────────
  vec3 outC = colL; float outA = aL;
  if (inA){
    vec3 Tv;
    vec3 sc = marchAtmo(rd, ta0, tEnd, b, Tv);
    vec3 insc = PI*uSunRad*sc;
    outC = insc + Tv*colL;
    float lumT = dot(Tv, vec3(0.2126, 0.7152, 0.0722));
    outA = 1.0 - (1.0 - aL)*lumT;
  }

#ifdef HAS_RINGS
  {
    float dn = dot(rd, uRingN);
    float tr = abs(dn) > 1e-4 ? dot(uC, uRingN)/dn : -1.0;
    if (tr > 0.0){
      vec3 Qr = rd*tr - uC;
      float rr = length(Qr);
      float pr = uPixAng*tr/max(abs(dn), 0.04);
      if (rr > uRingR.x - 2.0*pr && rr < uRingR.y + 2.0*pr){
        vec4 rg = ringAt(rr, pr);
        float tau = rg.a;
        if (tau > 0.001){
          float mus = abs(dot(uSun, uRingN)), muv = abs(dn);
          bool sameSide = dot(uSun, uRingN)*(-dn) > 0.0;
          vec3 Pq = rd*tr;
          float sh = 1.0;                                  // planet shadow on the rings
          {
            vec3 oc = uC - Pq; float bb = dot(oc, uSun);
            if (bb > 0.0){
              vec3 cps = oc - uSun*bb; float dd = length(cps);
              float pen = uSunSoft*bb + pix;
              sh = smoothstep(1.0 - pen, 1.0 + pen, dd);
            }
          }
          float cg = dot(rd, uSun);
          float ph = mix(hg(cg, 0.55), hg(cg, -0.25), 0.3)*4.0*PI*0.5 + 0.35;   // forward-peaked
          float e1 = exp(-tau/max(mus, 0.02)), e2 = exp(-tau/max(muv, 0.02));
          float refl = mus/(mus + muv)*(1.0 - exp(-tau*(1.0/max(mus, 0.02) + 1.0/max(muv, 0.02))));
          float trans = abs(mus - muv) < 0.01 ? (tau/max(mus, 0.02))*e1 : mus/(mus - muv)*(e1 - e2);
          float I = sameSide ? refl : max(trans, 0.0);
          vec3 lr = rg.rgb*uSunRad*(1.25*I*ph*sh) + rg.rgb*uAmb*(1.0 - e2)*2.0;
          float ra = 1.0 - e2;
          float aa = clamp(min((rr - uRingR.x)/max(pr, 1e-5), (uRingR.y - rr)/max(pr, 1e-5)) + 0.5, 0.0, 1.0);
          ra *= aa; lr *= aa;
          float bodyStart = inA ? ta0 : (hitP ? tp : 1e9);
          if (tr < bodyStart){ outC = lr + (1.0 - ra)*outC; outA = ra + (1.0 - ra)*outA; }
          else { outC = outC + (1.0 - outA)*lr; outA = outA + (1.0 - outA)*ra; }
        }
      }
    }
  }
#endif

  if (outA <= 0.0 && dot(outC, outC) <= 0.0) discard;

  float occl = texture2D(uBhTex, vNdc*0.5 + 0.5).a;
  float pathM = max(b, 0.0)*uDistScale;
  if (uBhOn > 0.5 && pathM > occl*1.002 + 0.002) discard;

  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(outC, outA)*uFade;
}
`;

export function buildFragment(bodyGLSL, defines = {}) {
  const defs = Object.entries(defines).map(([k, v]) => `#define ${k} ${v}`).join('\n');
  return `${defs}\n${HEADER}\n${NOISE_GLSL}\n${bodyGLSL}\n${CORE}`;
}

// ── distant-body point sprite (also beacons) ───────────────────────────────────────────────────────────────────────
export const SPRITE_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform vec4 uRect;
varying vec2 vNdc;
varying vec2 vLocal;
void main(){
  vec2 ndc = mix(uRect.xy, uRect.zw, position.xy*0.5 + 0.5);
  vNdc = ndc; vLocal = position.xy;
  gl_Position = vec4(ndc, 0.0, 1.0);
  #include <logdepthbuf_vertex>
}
`;
export const SPRITE_FRAG = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;        // peak colour (display units)
uniform float uSigmaN;      // gaussian sigma as a fraction of the quad half-width
uniform float uBhOn, uPathM;
uniform float uSpike;       // diffraction spikes strength
uniform sampler2D uBhTex;
varying vec2 vNdc;
varying vec2 vLocal;
void main(){
  vec2 q = vLocal;
  float r2 = dot(q, q);
  float g = exp(-r2/(2.0*uSigmaN*uSigmaN));
  float sp = uSpike*(exp(-abs(q.x)/(uSigmaN*6.0))*exp(-q.y*q.y/(uSigmaN*uSigmaN*0.25)) + exp(-abs(q.y)/(uSigmaN*6.0))*exp(-q.x*q.x/(uSigmaN*uSigmaN*0.25)));
  float w = g + sp;
  if (w < 1e-3) discard;
  float occl = texture2D(uBhTex, vNdc*0.5 + 0.5).a;
  if (uBhOn > 0.5 && uPathM > occl*1.002 + 0.002) discard;
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(uColor*w, 0.0);
}
`;

// ── entry-plasma overlay (full screen, additive) ───────────────────────────────────────────────────────────────────
export const PLASMA_FRAG = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform float uPlasma, uTime;
uniform vec3 uCol;
varying vec2 vNdc;
${NOISE_GLSL}
void main(){
  vec2 q = vNdc;
  float r = length(q*vec2(1.0, 0.8));
  float ang = atan(q.y, q.x);
  float streak = 0.0;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float a = ang*(18.0 + fi*13.0);
    float flow = r*(2.4 + fi*1.1) - uTime*(3.0 + fi*1.7);
    streak += max(0.0, sn(vec3(a, flow, fi*7.3))) * (0.6 - fi*0.14);
  }
  float rim = smoothstep(0.25, 1.15, r);
  float core = exp(-r*r*2.2)*0.35;
  float flick = 0.8 + 0.2*sn(vec3(uTime*21.0, 3.1, 1.7));
  float k = uPlasma*flick*(rim*(0.30 + streak*1.15) + core*0.30);
  vec3 c = uCol*k*1.5;
  c += vec3(1.0, 0.72, 0.38)*pow(max(rim, 0.0), 3.0)*streak*uPlasma*0.45;
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(c, 0.0);
}
`;
