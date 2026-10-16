// Charon — airless ice-rock moon of Lethe (R = 1250 km). Body frame: X → Lethe, Z north, Y east (lon +).
// Cratered ice-rock highlands: 3-D lattice craters at eight scales (analytic height gradients → bump normals,
// older craters softened, fresh ones bright), dark carbonaceous "maria" that fill the deepest basins (flat floors with a
// concentric wrinkle ridge), a Valhalla-style multi-ring basin, five bright / dark rayed craters, a tholin-red polar cap
// and tint, sparse lineaments, a long canyon, a smooth resurfaced plain round the Sentinel site (lat 8, lon 70) and
// Ferryman's Crater (lat -35, lon -40: terraced wall, dark floor, central uplift with ice spires). Regolith relief and
// grain fade in below ~1.5 R.  uP0 = (seed, relief exaggeration, 0, 0)
export default {
  id: 'charon',
  defines: {},
  params: (look) => ({ uP0: [look.seed ?? 5.3, 1.2, 0, 0] }),
  glsl: /* glsl */ `
const vec3 CH_FERRY = vec3(0.6275, -0.5266, -0.5736);   // Ferryman's Crater (lat -35, lon -40)
const vec3 CH_SENT  = vec3(0.3387, 0.9306, 0.1392);     // Sentinel site     (lat 8, lon 70)
const vec3 CH_RIFT  = vec3(-0.6040, -0.2198, 0.7660);   // pole of the great canyon's mean circle
const vec3 CH_RE1   = vec3(0.7198, 0.2620, 0.6428);     // canyon circle: point of highest latitude (40N, 20E)
const vec3 CH_RE2   = vec3(-0.3420, 0.9397, 0.0);       //                eastward tangent there

vec4  chSun;       // xyz: unit horizontal direction toward the light at p;  w: tan(sun elevation)
float chSoft;      // penumbra half-width in slope (tan) units
float chShd;       // accumulated cast-shadow amount (rims / canyon walls onto the lows), [0,1]

// gradient noise with analytic gradient: (value ≈ [-1,1], d/dx)
vec4 chSnd(vec3 x){
  vec3 i = floor(x), w = fract(x);
  vec3 u  = w*w*w*(w*(w*6.0 - 15.0) + 10.0);
  vec3 du = 30.0*w*w*(w*(w - 2.0) + 1.0);
  vec3 ga = h33(i)*2.0 - 1.0;
  vec3 gb = h33(i + vec3(1.0, 0.0, 0.0))*2.0 - 1.0;
  vec3 gc = h33(i + vec3(0.0, 1.0, 0.0))*2.0 - 1.0;
  vec3 gd = h33(i + vec3(1.0, 1.0, 0.0))*2.0 - 1.0;
  vec3 ge = h33(i + vec3(0.0, 0.0, 1.0))*2.0 - 1.0;
  vec3 gf = h33(i + vec3(1.0, 0.0, 1.0))*2.0 - 1.0;
  vec3 gg = h33(i + vec3(0.0, 1.0, 1.0))*2.0 - 1.0;
  vec3 gh = h33(i + vec3(1.0, 1.0, 1.0))*2.0 - 1.0;
  float va = dot(ga, w);
  float vb = dot(gb, w - vec3(1.0, 0.0, 0.0));
  float vc = dot(gc, w - vec3(0.0, 1.0, 0.0));
  float vd = dot(gd, w - vec3(1.0, 1.0, 0.0));
  float ve = dot(ge, w - vec3(0.0, 0.0, 1.0));
  float vf = dot(gf, w - vec3(1.0, 0.0, 1.0));
  float vg = dot(gg, w - vec3(0.0, 1.0, 1.0));
  float vh = dot(gh, w - vec3(1.0, 1.0, 1.0));
  float k1 = vb - va, k2 = vc - va, k3 = ve - va;
  float k4 = va - vb - vc + vd, k5 = va - vc - ve + vg, k6 = va - vb - ve + vf;
  float k7 = -va + vb + vc - vd + ve - vf - vg + vh;
  float v = va + k1*u.x + k2*u.y + k3*u.z + k4*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z;
  vec3 g = ga + u.x*(gb - ga) + u.y*(gc - ga) + u.z*(ge - ga)
         + u.x*u.y*(ga - gb - gc + gd) + u.y*u.z*(ga - gc - ge + gg) + u.z*u.x*(ga - gb - ge + gf)
         + u.x*u.y*u.z*(-ga + gb + gc - gd + ge - gf - gg + gh)
         + du*vec3(k1 + k4*u.y + k6*u.z + k7*u.y*u.z,
                   k2 + k5*u.z + k4*u.x + k7*u.z*u.x,
                   k3 + k6*u.x + k5*u.y + k7*u.x*u.y);
  return 1.55*vec4(v, g);
}

// fbm with analytic gradient w.r.t. its argument: (value [0,1], gradient); octaves finer than a pixel fade out
vec4 chFbmD(vec3 p, int oct, float fp){
  float s = 0.0, a = 0.5, fr = 1.0;
  vec3 g = vec3(0.0);
  mat3 R = mat3(1.0);
  for (int i = 0; i < 6; i++){
    if (i >= oct) break;
    float w = 1.0 - smoothstep(0.35, 0.95, fr*fp);
    if (w <= 0.0) break;
    vec4 nd = chSnd(p);
    s += a*w*nd.x;
    g += a*w*(nd.yzw*R);
    p = M3*p*2.02 + vec3(1.7, 9.2, 4.1);
    R = M3*R*2.02;
    a *= 0.5; fr *= 2.02;
  }
  float n = 1.0 - exp2(-float(oct));
  return vec4(clamp(0.5 + 0.5*s/n, 0.0, 1.0), 0.5*g/n);
}

// periodic value noise around a circle (a = fraction of a turn in [0,1], N lattice cells, integer N) in [-1,1]
float chAng(float a, float N, float seed){
  float x = a*N;
  float i0 = floor(x);
  float f = x - i0;
  f = f*f*(3.0 - 2.0*f);
  return 2.0*mix(h11(mod(i0, N)*1.37 + seed), h11(mod(i0 + 1.0, N)*1.37 + seed), f) - 1.0;
}
float chTurn(vec2 v){ return atan(v.y, v.x + 1e-7)*0.15915494 + 0.5; }

// shadow cast onto a point inside a bowl by the crater's own sunward rim.  dvn: offset from the centre in crater radii
// (tangent plane), dHn: (rim height - height at the point) in crater radii.
float chRimShadow(vec3 dvn, float dHn){
  float tp = dot(dvn, chSun.xyz);
  float rim2 = 1.0 - (dot(dvn, dvn) - tp*tp);
  if (rim2 <= 0.0) return 0.0;
  float sd = sqrt(rim2) - tp;                    // distance along the light to the rim crest
  return smoothstep(-chSoft, chSoft, dHn/max(sd, 1e-3) - chSun.w);
}

// crater profile in crater radii (x = d/Rc): (height, d height/d x) in units of Rc
vec2 chProf(float x, float dep, float rim, float flo, float age){
  float t = clamp((x - flo)/(1.0 - flo), 0.0, 1.0);
  float sm = t*t*(3.0 - 2.0*t);
  float h = -dep*(1.0 - sm);
  float dh = (x > flo && x < 1.0) ? dep*6.0*t*(1.0 - t)/(1.0 - flo) : 0.0;
  float u = x - 1.0;
  float w = u < 0.0 ? 0.15 + 0.12*age : 0.30 + 0.12*age;
  float e = rim*exp(-(u*u)/(w*w));
  float tt = clamp(u/0.3, 0.0, 1.0);                       // the rim / blanket dies out smoothly by x = 1.3
  float T = 1.0 - tt*tt*(3.0 - 2.0*tt);
  float dT = (u > 0.0 && u < 0.3) ? -6.0*tt*(1.0 - tt)/0.3 : 0.0;
  return vec2(h + e*T, dh - 2.0*u/(w*w)*e*T + e*dT);
}

// one lattice crater: centre projected onto the sphere, size / age / depth from the cell hash
void chCrater(vec3 p, float f, vec3 off, vec3 cid, vec3 hA, float occ, float fresh, float keep, float lod, inout vec4 H, inout vec2 A){
  vec3 hB = fract(hA.zxy*vec3(37.17, 53.31, 71.97) + hA.yzx*vec3(11.3, 5.7, 3.1) + 0.31);
  if (hB.x > occ) return;
  vec3 cv = cid + 0.5 + (hA - 0.5)*0.70 - off;
  float cl = length(cv);
  if (abs(cl - f) > 0.30) return;
  float rc = 0.09 + 0.18*hB.y*hB.y;
  vec3 dv = p*f - cv*(f/cl);
  float d = length(dv);
  float x = d/rc;
  if (x > 1.3) return;
  float rR = rc/f;
  float wl = smoothstep(0.7, 2.2, rR/lod);
  if (wl <= 0.0) return;
  float u = hB.z;
  float age = u < fresh ? 0.10*u/fresh : 0.25 + 0.75*sqrt((u - fresh)/(1.0 - fresh));
  float big = smoothstep(0.012, 0.07, rR);
  float dep = mix(0.22, 0.08, age)*(1.0 - 0.35*big)*(0.7 + 0.6*fract(hB.x*13.7));
  float rim = mix(0.06, 0.014, age);
  vec2 pr = chProf(x, dep, rim, 0.25 + 0.20*big, age);
  float pk = 0.45*dep*big*exp(-x*x/0.025);
  pr += vec2(pk, -2.0*x/0.025*pk);
  float kk = keep*wl;
  H.x += kk*rR*pr.x;
  H.yzw += kk*pr.y*dv/max(d, 1e-5);
  float fr = (1.0 - age)*(1.0 - age);
  A.x += kk*fr*fr*0.55*(1.0 - smoothstep(0.45, 1.3, x));
  A.y += kk*big*(1.0 - smoothstep(0.3, 0.9, x))*(0.04 + 0.16*age);
  if (x < 1.0 && chSun.w < 0.6) chShd = max(chShd, kk*chRimShadow(dv/rc, max(rim - pr.x, 0.0)));
}

// all lattice-crater scales in [L0, L1): eight scales (coarse → fine), the 2x2x2 nearest cells of each, 1-3 craters per cell
void chLayers(vec3 p, int L0, int L1, float sd, float keep, float lod, inout vec4 H, inout vec2 A){
  for (int L = L0; L < L1; L++){
    float fL = float(L);
    float f = L == 0 ? 1.7 : (L == 1 ? 3.2 : (L == 2 ? 6.8 : (L == 3 ? 14.5 : (L == 4 ? 31.0 : (L == 5 ? 66.0 : (L == 6 ? 140.0 : 300.0))))));
    if (0.27/f < 1.0*lod) break;                                 // finer scales are sub-pixel
    float occ = L == 0 ? 0.55 : (L < 3 ? 0.70 : (L < 5 ? 0.60 : (L < 7 ? 0.80 : 0.72)));
    float fresh = 0.02*fL + 0.02;
    int nPer = L < 2 ? 1 : 2;
    float sdL = L == 0 ? sd + 7.0 : sd + fL - 1.0;
    vec3 off = vec3(sdL*3.17, sdL*1.91, sdL*-2.43);
    vec3 q = p*f + off;
    vec3 ic = floor(q);
    vec3 sg = vec3(fract(q.x) < 0.5 ? -1.0 : 1.0, fract(q.y) < 0.5 ? -1.0 : 1.0, fract(q.z) < 0.5 ? -1.0 : 1.0);
    for (int c = 0; c < 8; c++){
      vec3 cid = ic + vec3(float(c & 1), float((c >> 1) & 1), float(c >> 2))*sg;
      vec3 h0 = h33(cid + sdL*0.37);
      for (int n = 0; n < 3; n++){
        if (n >= nPer) break;
        vec3 hh = h0;
        if (n > 0){
          float e = float(n - 1);
          hh = fract(h0*(vec3(13.7, 17.3, 19.1) + e*vec3(10.2, 12.0, 12.6)) + h0.zxy*(vec3(7.1, 3.3, 5.9) + e*vec3(-1.8, 8.4, -3.0)) + 0.17 + 0.44*e);
        }
        chCrater(p, f, off, cid, hh, occ, fresh, keep, lod, H, A);
      }
    }
  }
}

// concentric ring ridge: (height, d height / d x) in units of rho
vec2 chRing(float x, float x0, float a, float w){
  float u = (x - x0)/w;
  float e = a*exp(-u*u);
  return vec2(e, -2.0*u/w*e);
}

// old multi-ring basin (Valhalla style): shallow dish, central dome and concentric ring scarps
void chBasin(vec3 p, vec3 c, float rho, float amp, float lod, inout vec4 H, inout vec2 A){
  vec3 dv = p - c;
  float d = length(dv);
  if (d > 2.5*rho) return;
  vec3 be1 = normalize(cross(c, vec3(0.31, 0.17, 0.94)));
  vec2 ba = vec2(dot(dv, be1), dot(dv, cross(c, be1)));
  float x = (d/rho)*(1.0 + 0.035*chAng(chTurn(ba), 4.0, c.x*9.0 + 3.1));
  if (x > 2.3) return;
  float wl = smoothstep(0.7, 2.2, rho/lod);
  vec2 pr = chProf(x, 0.03 + 0.03*(1.0 - amp), 0.04, 0.35, 1.0);
  vec2 rg = chRing(x, 0.50, 0.030, 0.07) + chRing(x, 0.78, 0.024, 0.06);
  rg += (chRing(x, 1.30, 0.020, 0.09) + chRing(x, 1.62, 0.014, 0.10) + chRing(x, 1.95, 0.008, 0.12))*amp;
  pr += rg + chRing(x, 0.16, 0.040, 0.12);
  H.x += wl*rho*pr.x;
  H.yzw += wl*pr.y*dv/max(d, 1e-5);
  A.x += wl*(0.45*clamp(rg.x/0.03, 0.0, 1.0) + 0.25*exp(-(x - 1.0)*(x - 1.0)/0.05))*(0.5 + 0.5*amp);
}

// fresh rayed crater: bowl + rim, bright (sgn > 0) or dark (sgn < 0) ejecta blanket and long rays
void chRayed(vec3 p, vec3 c, float rho, float sgn, float sdr, float lod, inout vec4 H, inout vec2 A){
  vec3 dv = p - c;
  float d = length(dv);
  float x0 = d/rho;
  if (x0 > 15.0) return;
  float wl = smoothstep(0.7, 2.2, rho/lod);
  vec3 dir3 = dv/max(d, 1e-5);
  vec3 e1 = normalize(cross(c, vec3(0.31, 0.17, 0.94)));
  vec3 e2 = cross(c, e1);
  vec2 a = vec2(dot(dv, e1), dot(dv, e2));
  float t = chTurn(a);
  float xs = 1.0 + 0.06*chAng(t, 5.0, sdr + 3.3);                 // irregular outline
  float x = x0*xs;
  if (x < 1.5){
    vec2 pr = chProf(x, 0.28, 0.10, 0.30, 0.05);
    H.x += wl*rho*pr.x;
    H.yzw += wl*pr.y*dir3;
    if (x < 1.0 && chSun.w < 0.6) chShd = max(chShd, wl*chRimShadow(dv*xs/rho, max(0.10 - pr.x, 0.0)));
  }
  float rn = 0.30*chAng(t, 7.0, sdr) + 0.42*chAng(t + 0.0022*x, 19.0, sdr + 5.0) + 0.28*chAng(t + 0.004*x, 53.0, sdr + 11.0);
  float rl = 1.0 - smoothstep(0.25, 0.7, lod/(0.5*d + 1e-4));
  float thr = 0.10 + 0.020*x;
  float ray = smoothstep(thr, thr + 0.20, rn)*rl*(0.7 + 0.3*chAng(t + 0.0073*x, 11.0, sdr + 17.0));
  float fall = pow(max(x, 1.0), -0.75)*(1.0 - smoothstep(8.0, 15.0, x));
  float blanket = exp(-0.85*max(x - 1.0, 0.0))*(1.0 - smoothstep(2.0, 4.5, x))*(0.65 + 0.35*clamp(rn*1.6 + 0.5, 0.0, 1.0))*(0.55 + 0.45*smoothstep(0.55, 1.0, x));
  float amt = fall*ray*smoothstep(1.0, 1.4, x) + 0.75*blanket;
  if (sgn > 0.0) A.x += amt*1.3; else A.y += amt*0.9;
}

// Ferryman's Crater: terraced wall, dark floor, central uplift with ice spires, bright blanket
void chFerry(vec3 p, float lod, inout vec4 H, inout vec2 A){
  const float rho = 0.15;
  vec3 dv = p - CH_FERRY;
  float d = length(dv);
  float x0 = d/rho;
  if (x0 > 2.7) return;
  vec3 dir3 = dv/max(d, 1e-5);
  vec3 e1 = normalize(cross(CH_FERRY, vec3(0.31, 0.17, 0.94)));
  vec3 e2 = cross(CH_FERRY, e1);
  vec2 a2 = vec2(dot(dv, e1), dot(dv, e2));
  float ta = chTurn(a2);
  float wob = chAng(ta, 5.0, 3.7) + 0.5*chAng(ta, 11.0, 8.3);
  float wp = chAng(ta, 6.0, 11.3);                     // terrace phase varies with azimuth
  float xs = 1.0 + 0.045*wob;                           // scalloped, slumped outline
  float x = x0*xs;
  float D = 0.0150;
  float t = clamp((1.0 - x)/0.45, 0.0, 1.0);
  float u = t*t*(3.0 - 2.0*t);
  float ph = 18.8496*u + 2.6*wp;
  float S = u - 0.55*(sin(ph) - sin(2.6*wp))/18.8496;
  float dS = (x > 0.55 && x < 1.0) ? (1.0 - 0.55*cos(ph))*6.0*t*(1.0 - t)*(-1.0/0.45) : 0.0;
  float hh = -D*S, dh = -D*dS;
  float ur = x - 1.0;
  float wr = ur < 0.0 ? 0.045 : 0.20;
  float er = 0.0045*exp(-(ur*ur)/(wr*wr));
  hh += er; dh += -2.0*ur/(wr*wr)*er;
  float xb = max(x, 1.0);
  float tb = clamp((xb - 1.0)/1.4, 0.0, 1.0);
  hh += 0.0016*(1.0 - tb*tb*(3.0 - 2.0*tb));
  dh += (x > 1.0) ? -0.0016*6.0*tb*(1.0 - tb)/1.4 : 0.0;
  float cu = 1.0 - smoothstep(0.0, 0.30, x);
  float dcu = (x < 0.30) ? -6.0*(x/0.30)*(1.0 - x/0.30)/0.30 : 0.0;
  hh += 0.0085*cu*cu; dh += 0.0085*2.0*cu*dcu;
  float wl = smoothstep(0.7, 2.2, rho/lod);
  float wallM = smoothstep(0.45, 0.6, x)*(1.0 - smoothstep(1.2, 1.9, x))*smoothstep(0.7, 2.0, 0.026/lod);
  H.x += wl*hh;
  H.yzw += wl*(dh/rho)*dir3;
  if (wallM > 0.0){                                       // slump / hummock texture on the wall and inner blanket
    vec4 wn = chSnd(p*38.0 + vec3(7.7, 1.3, 4.4));
    H.x += wl*0.0010*wn.x*wallM;
    H.yzw += wl*0.0010*38.0*wn.yzw*wallM;
  }
  float spire = 0.0, hsp = 0.0;
  if (x < 0.34){
    for (int i = 0; i < 7; i++){
      vec3 hs = h33(vec3(float(i)*1.7 + 3.1, 11.3, 5.9));
      float ang = 6.2832*hs.x;
      float rad = rho*(0.015 + 0.17*hs.y*hs.y);
      vec3 sp = CH_FERRY + (e1*cos(ang) + e2*sin(ang))*rad;
      float rs = 0.0040 + 0.0050*hs.z;
      float hsH = 0.0032 + 0.0058*fract(hs.x*7.3 + hs.z*3.1);
      vec3 ds = p - sp;
      float dd = length(ds);
      float k = 1.0 - dd/rs;
      if (k > 0.0){
        float ws = smoothstep(0.4, 1.6, rs/lod);
        float hk = ws*hsH*pow(k, 1.5);
        H.x += hk;
        H.yzw += ws*(-hsH*1.5*sqrt(k)/rs)*ds/max(dd, 1e-5);
        spire = max(spire, ws*k);
        hsp = max(hsp, hk);
      }
    }
  }
  if (x < 1.0 && chSun.w < 0.6) chShd = max(chShd, wl*chRimShadow(dv*xs/rho, max(0.0061 - hh - hsp, 0.0)*xs/rho));
  A.y += 0.80*(1.0 - smoothstep(0.50, 0.64, x))*(1.0 - 0.85*cu);
  A.x += 0.55*exp(-(x - 1.15)*(x - 1.15)/0.40)*smoothstep(0.92, 1.02, x) + 0.30*cu*cu + 1.1*spire;
}

// the great canyon: a wandering great-circle trough, tapering out at both ends
void chRift(vec3 p, float nW, float lod, inout vec4 H, inout vec2 A){
  float sl = dot(p, CH_RIFT);
  if (abs(sl) > 0.26) return;
  float ph = degrees(atan(dot(p, CH_RE2), dot(p, CH_RE1)));
  float ends = smoothstep(-70.0, -40.0, ph)*(1.0 - smoothstep(45.0, 75.0, ph));
  if (ends <= 0.0) return;
  vec4 w1 = chSnd(p*2.6 + vec3(5.1, 1.3, 8.8));
  vec4 w2 = chSnd(p*8.5 + vec3(2.7, 9.9, 3.3));
  float s = sl + 0.085*w1.x + 0.013*w2.x;
  vec3 gs = CH_RIFT + 0.085*2.6*w1.yzw + 0.013*8.5*w2.yzw;
  float gl = max(length(gs), 0.3);
  float dist = s/gl;
  float wid = (0.040 + 0.030*smoothstep(0.30, 0.70, nW))*(0.35 + 0.65*ends);
  float dep = (0.0050 + 0.0060*smoothstep(0.35, 0.65, nW))*ends;
  float u = abs(dist)/wid;
  if (u > 2.6) return;
  float tw = clamp((u - 0.35)/0.65, 0.0, 1.0);
  float sm = tw*tw*(3.0 - 2.0*tw);
  float h = -dep*(1.0 - sm);
  float dh = (u > 0.35 && u < 1.0) ? dep*6.0*tw*(1.0 - tw)/0.65 : 0.0;
  float ur = (u - 1.12)/0.30;
  float er = 0.10*dep*exp(-ur*ur);
  h += er; dh += -2.0*ur/0.30*er;
  float wl = smoothstep(0.5, 2.0, wid/lod);
  float wallW = smoothstep(0.30, 0.7, u)*(1.0 - smoothstep(1.0, 1.5, u));
  float tx = 0.16*dep*wallW;                              // slump texture on the walls
  h += tx*w2.x;
  H.x += wl*h;
  H.yzw += wl*((dh/wid)*sign(dist)*gs/gl + tx*8.5*w2.yzw);
  A.y += wl*0.30*(1.0 - smoothstep(0.35, 0.75, u));
  A.x += wl*0.20*exp(-ur*ur);
  float cs = dot(chSun.xyz, gs)/gl;                       // light azimuth across the trench (toward +dist)
  float sg = cs >= 0.0 ? 1.0 : -1.0;
  float rimd = 1.12*wid - dist*sg;                        // across-trench distance to the sunward rim crest (> 0: below it)
  if (chSun.w < 0.6 && rimd > 0.0){                       // the sunward wall shades the floor
    float sdist = rimd/max(abs(cs), 0.02);
    chShd = max(chShd, wl*smoothstep(0.0, 0.10*wid, rimd)*smoothstep(-chSoft, chSoft, max(0.10*dep - h, 0.0)/max(sdist, 1e-4) - chSun.w));
  }
}

// linear tectonics: sparse, gently wandering parallel lineaments (phase field with a smooth warp); each line is either a
// graben-like trough or a thrust ridge with a steep face, with its own width / height
void chGroove(vec3 p, vec3 ax, float fq, float pres, float mask, float lod, inout vec4 H, inout vec2 A){
  if (mask < 0.02) return;
  vec4 w = chSnd(p*2.1 + vec3(2.3, 7.1, 4.7) + ax*3.0);
  float v = dot(p, ax)*fq + 1.8*w.x;
  vec3 gv = ax*fq + 1.8*2.1*w.yzw;
  float gi = floor(v + 0.5);
  if (h11(gi*7.31 + fq) > pres) return;
  float gl = max(length(gv), 1.0);
  float wid = min(0.012 + 0.018*h11(gi*2.71 + 1.3), 0.17/gl);          // the profile must stay inside its own phase cell
  float dist = (v - gi)/gl;
  float dn = dist/wid;
  float wl = smoothstep(0.6, 2.2, wid/lod)*mask;
  float dp = 0.0006 + 0.0014*h11(gi*3.17 + 5.0);
  if (h11(gi*5.77 + 2.0) < 0.5){
    float u = abs(dn);
    if (u > 2.2) return;
    float tw = clamp(u, 0.0, 1.0);
    float h = -dp*(1.0 - tw*tw*(3.0 - 2.0*tw));
    float dh = (u < 1.0) ? dp*6.0*tw*(1.0 - tw) : 0.0;
    float ur = (u - 1.1)/0.35;
    float er = 0.2*dp*exp(-ur*ur);
    h += er; dh += -2.0*ur/0.35*er;
    H.x += wl*h;
    H.yzw += wl*(dh/wid)*sign(dist)*gv/gl;
    A.y += wl*0.20*(1.0 - smoothstep(0.2, 0.9, u));
  } else {
    float L = min(8.0*wid, 0.42/gl);                     // back slope must die out before the next furrow's cell
    if (dist < -2.0*wid || dist > L) return;
    float h, dh;
    if (dist < 0.0){ float t = clamp(dist/(2.0*wid) + 1.0, 0.0, 1.0); h = t*t*(3.0 - 2.0*t); dh = 3.0*t*(1.0 - t)/wid; }
    else { float t = clamp(dist/L, 0.0, 1.0); h = 1.0 - t*t*(3.0 - 2.0*t); dh = -6.0*t*(1.0 - t)/L; }
    H.x += wl*dp*h;
    H.yzw += wl*dp*dh*gv/gl;
    A.x += wl*0.12*exp(-dn*dn*0.5);
  }
}

// wrinkle ridges (zero set of a noise field → low, sinuous ridges) on the flooded basin floors and plains
void chWrinkle(vec3 p, float mask, float lod, inout vec4 H, inout vec2 A){
  if (mask < 0.05) return;
  vec4 n = chSnd(p*6.0 + vec3(4.1, 2.2, 6.3));
  float gl = max(length(n.yzw)*6.0, 2.0);
  float dist = n.x/gl;
  float wid = 0.013;
  float u = abs(dist)/wid;
  if (u > 2.4) return;
  float wl = smoothstep(0.6, 2.2, wid/lod)*mask;
  float e = 0.0011*exp(-u*u*1.3);
  H.x += wl*e;
  H.yzw += wl*(-2.6*u*e/wid)*sign(dist)*n.yzw*6.0/gl;
  A.x += wl*0.10*exp(-u*u*1.3);
}

Surf surfaceAt(vec3 p, vec3 sunB, float lod){
  Surf s = surfDefault(p);
  float sd = uP0.x;
  vec3 so = vec3(sd*1.37, sd*0.71, -sd*0.43);
  float mu0 = dot(p, sunB);                                                // light direction at p, for cast shadows
  vec3 lh = sunB - p*mu0;
  float lhl = max(length(lh), 1e-4);
  chSun = vec4(lh/lhl, mu0/lhl);
  chSoft = clamp(uSunSoft, 0.008, 0.06);
  chShd = 0.0;

  // ── provinces ──
  float nB = fbmL(p*1.9 + so*1.7 + 13.0, 5, lod*1.9);
  float nM = fbmL(p*6.5 + so*0.9 + 31.0, 4, lod*6.5);
  float zone = nB + 0.18*(nM - 0.5);
  float pfx = fbmL(p*1.25 + so + 3.0, 4, lod*1.25);
  float ew = 0.02 + 1.1*lod;
  float plainN = smoothstep(0.645 - ew, 0.645 + ew, pfx)*(1.0 - smoothstep(0.50, 0.58, zone));   // smooth resurfaced plains
  float dS = length(p - CH_SENT);
  float plain = max(plainN, 1.0 - smoothstep(0.07, 0.18, dS + 0.08*(pfx - 0.5)));
  float fx = length(p - CH_FERRY)/0.15;
  float kFer = mix(0.2, 1.0, smoothstep(0.55, 0.80, fx));                  // smooth impact-melt floor

  // ── relief: H.x = height (R), H.yzw = gradient;  A.x = fresh-ice brightening, A.y = darkening ──
  vec4 H = vec4(0.0);
  vec2 A = vec2(0.0);
  float kBig = (1.0 - 0.55*plain)*kFer;
  chBasin(p, normalize(vec3(-0.80, -0.10, -0.12)), 0.19, 0.5, lod, H, A);
  chBasin(p, normalize(vec3(0.62, 0.30, -0.72)), 0.20, 0.5, lod, H, A);
  chLayers(p, 0, 3, sd, kBig, lod, H, A);
  // flooding: basins deeper than the local flood level fill with flat dark material (+ a concentric wrinkle ridge)
  float Lf = mix(-0.011, -0.0030, smoothstep(0.50, 0.60, zone));
  float fm = (1.0 - smoothstep(Lf - 0.0008, Lf + 0.0003, H.x))*(1.0 - plain);
  float dk = smoothstep(0.575, 0.605, zone - 16.0*H.x)*(1.0 - plain);      // dark terrain: fills the lows
  float hgl = max(length(H.yzw), 0.04);
  float rg1 = (H.x - (Lf - 0.0016))/hgl;
  float ru = abs(rg1)/0.010;
  float rwl = smoothstep(0.6, 2.2, 0.010/lod)*fm;
  float rr = rwl*0.0010*exp(-ru*ru*1.5);
  vec3 rgrad = (ru < 2.5) ? (-3.0*ru*rr/0.010)*sign(rg1)*H.yzw/hgl : vec3(0.0);
  float rA = rwl*0.08*exp(-ru*ru*1.5);
  H.x = mix(H.x, Lf, fm) + rr;
  H.yzw = H.yzw*(1.0 - fm) + rgrad;
  float kSm = (1.0 - 0.93*plain)*kFer*(1.0 - 0.55*fm)*(1.0 - 0.35*dk);
  chBasin(p, normalize(vec3(-0.55, 0.62, 0.55)), 0.26, 1.0, lod, H, A);    // the great multi-ring basin (never floods)
  chFerry(p, lod, H, A);
  for (int i = 0; i < 5; i++){                                            // fresh rayed craters
    vec3 rcen = i == 0 ? vec3(0.9097, 0.3311, 0.2486) : (i == 1 ? vec3(-0.26097, 0.85316, -0.45168) : (i == 2 ? vec3(0.33966, -0.19980, -0.91908) : (i == 3 ? vec3(-0.49965, -0.54962, 0.66953) : vec3(0.29208, -0.92490, -0.24340))));
    float rrho = i == 0 ? 0.035 : (i == 1 ? 0.030 : (i == 2 ? 0.040 : (i == 3 ? 0.028 : 0.032)));
    chRayed(p, rcen, rrho, i == 1 ? -1.0 : 1.0, sd + float(i + 1), lod, H, A);
  }
  chLayers(p, 3, 8, sd, kSm, lod, H, A);
  chRift(p, nM, lod, H, A);
  for (int i = 0; i < 2; i++){                                            // two belts of lineaments
    vec3 bn = i == 0 ? vec3(-0.30, 0.93, 0.21) : vec3(0.62, -0.20, 0.76);
    float bw0 = i == 0 ? 0.16 : 0.14;
    float belt = (1.0 - smoothstep(bw0, bw0 + 0.18 + (i == 0 ? 0.0 : -0.02), abs(dot(p, bn) + 0.12*(nM - 0.5))))*(1.0 - max(plain, dk))*(1.0 - fm)*smoothstep(1.1, 1.8, fx);
    chGroove(p, i == 0 ? vec3(0.4264, -0.5970, 0.6819) : vec3(0.8167, 0.4900, 0.3085), i == 0 ? 7.0 : 9.0, i == 0 ? 0.5 : 0.45, belt, lod, H, A);
  }
  chWrinkle(p, plain*0.8, lod, H, A);
  A.x += rA;
  if (lod < 0.02){                                        // gentle hummocky relief between the craters
    vec4 th = chFbmD(p*9.0 + so*2.0, 4, lod*9.0);
    H.yzw += 0.0060*9.0*th.yzw*(1.0 - 0.7*max(plain, fm));
  }
  float gr1 = 0.5, gr2 = 0.5;
  if (lod < 0.004){                                       // fine regolith relief (its value also grains the albedo)
    vec4 mr = chFbmD(p*160.0 + so, 3, lod*160.0);
    H.yzw += 0.0005*160.0*mr.yzw*(1.0 - 0.3*plain);
    gr1 = mr.x;
    if (lod < 0.0008){
      vec4 mf = chFbmD(p*900.0 + so*3.0, 2, lod*900.0);
      H.yzw += 0.00009*900.0*mf.yzw;
      gr2 = mf.x;
    }
  }

  // ── albedo ──
  float nG = fbmL(p*31.0 + so + 7.0, 3, lod*31.0);
  vec3 cIce  = vec3(0.57, 0.59, 0.65);                                     // bright water-ice terrain
  vec3 cGrey = vec3(0.33, 0.34, 0.36);                                     // ice-rock highlands
  vec3 cTho  = vec3(0.25, 0.195, 0.165);                                   // tholin-reddish
  vec3 cMare = vec3(0.118, 0.112, 0.108);                                  // dark carbonaceous fill
  float iceAmt = smoothstep(0.50, 0.66, nB + 0.12*(nG - 0.5));
  vec3 alb = mix(cGrey, cIce, iceAmt);
  alb = mix(alb, cIce*0.92, plain*0.35);
  vec3 tint = mix(vec3(1.0), vec3(1.04, 0.995, 0.94), 1.0 - smoothstep(0.40, 0.52, nB));
  alb *= tint;
  float tho = smoothstep(0.70, 0.86, p.z + 0.18*(nM - 0.5) + 0.10*(nB - 0.5) + 0.06*(nG - 0.5));
  alb = mix(alb, cTho*(0.85 + 0.5*nG), tho*0.80);
  alb = mix(alb, cMare*(0.85 + 0.3*nG), max(fm, dk)*0.92);
  alb *= 0.80 + 0.40*nG;
  alb *= (0.86 + 0.28*smoothstep(0.30, 0.70, gr1))*(0.82 + 0.36*smoothstep(0.25, 0.75, gr2));

  vec3 g = H.yzw;
  float gl = length(g);
  g *= min(1.0, 1.7/max(gl, 1e-4));
  float sl = min(gl, 1.7);
  alb = mix(alb, vec3(0.78, 0.81, 0.87), clamp(0.65*A.x, 0.0, 0.92));      // fresh ice: rims, ejecta, rays, cliffs
  alb *= (1.0 - 0.6*clamp(A.y, 0.0, 1.0))*(1.0 + 0.28*smoothstep(0.10, 0.45, sl));
  vec3 nrm = perturb(p, g*uP0.y);
  float shd = clamp(chShd, 0.0, 1.0);
  if (shd > 0.0){                                                          // dim by the shadowed share of the direct light
    vec3 pdB = vec3(dot(uParentDir, uAx), dot(uParentDir, uAy), dot(uParentDir, uAz));
    float dir = dot(uSunRad, vec3(0.30, 0.59, 0.11))*max(dot(nrm, sunB), 0.0);
    float ind = dot(uAmb, vec3(0.30, 0.59, 0.11)) + dot(uParentRad, vec3(0.30, 0.59, 0.11))*max(dot(nrm, pdB), 0.0)*(0.25 + 0.75*step(0.0, dot(p, pdB)));
    alb *= 1.0 - shd*dir/(dir + ind + 1e-4);
  }
  s.albedo = clamp(alb, 0.0, 0.92);
  s.nrm = nrm;
  s.rough = 0.55;
  s.spec = 0.045*clamp(iceAmt + 0.6*A.x, 0.0, 1.0)*(1.0 - max(fm, dk))*(1.0 - 0.8*tho)*(1.0 - shd);
  return s;
}
`,
};
