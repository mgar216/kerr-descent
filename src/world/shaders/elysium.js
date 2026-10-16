// Elysium — rogue world of the negative-mass universe: a shattered black-glass crust, lit only by the giant galaxy of the
// anti-sky (broad glassy sheen, no hard shadows) and by its own phosphorescence: cyan & violet crystal veins that follow
// the plate boundaries and long rivers, dense "crystal gardens" with faceted spires. Glow is strongest on the night side.
// uP0 = (seed, glow gain, 0, 0), uP1.rgb = cyan glow, uP2.rgb = violet glow, uP3.rgb = crust colour
export default {
  id: 'elysium',
  defines: {},
  params: (look) => ({
    uP0: [look.seed ?? 17.4, 1, 0, 0],
    uP1: [...(look.glow ?? [0.15, 0.85, 1.0]), 0],
    uP2: [...(look.glow2 ?? [0.62, 0.30, 1.0]), 0],
    uP3: [...(look.color ?? [0.03, 0.04, 0.07]), 0],
  }),
  glsl: /* glsl */ `
#define EL_FP  3.4
#define EL_FP2 11.0
#define EL_FP3 34.0

// gradient noise with analytic derivative: (value ≈ [-1,1], ∇ wrt p)
vec4 elSnd(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*f*(f*(f*6.0 - 15.0) + 10.0);
  vec3 du = 30.0*f*f*(f*(f - 2.0) + 1.0);
  vec3 ga = h33(i)*2.0 - 1.0;
  vec3 gb = h33(i + vec3(1.,0.,0.))*2.0 - 1.0;
  vec3 gc = h33(i + vec3(0.,1.,0.))*2.0 - 1.0;
  vec3 gd = h33(i + vec3(1.,1.,0.))*2.0 - 1.0;
  vec3 ge = h33(i + vec3(0.,0.,1.))*2.0 - 1.0;
  vec3 gf = h33(i + vec3(1.,0.,1.))*2.0 - 1.0;
  vec3 gg = h33(i + vec3(0.,1.,1.))*2.0 - 1.0;
  vec3 gh = h33(i + vec3(1.,1.,1.))*2.0 - 1.0;
  float va = dot(ga, f), vb = dot(gb, f - vec3(1.,0.,0.)), vc = dot(gc, f - vec3(0.,1.,0.)), vd = dot(gd, f - vec3(1.,1.,0.));
  float ve = dot(ge, f - vec3(0.,0.,1.)), vf = dot(gf, f - vec3(1.,0.,1.)), vg = dot(gg, f - vec3(0.,1.,1.)), vh = dot(gh, f - vec3(1.,1.,1.));
  float k1 = va - vb - vc + vd, k2 = va - vc - ve + vg, k3 = va - vb - ve + vf, k4 = -va + vb + vc - vd + ve - vf - vg + vh;
  float v = va + u.x*(vb - va) + u.y*(vc - va) + u.z*(ve - va) + u.x*u.y*k1 + u.y*u.z*k2 + u.z*u.x*k3 + u.x*u.y*u.z*k4;
  vec3 g = ga + u.x*(gb - ga) + u.y*(gc - ga) + u.z*(ge - ga) + u.x*u.y*(ga - gb - gc + gd) + u.y*u.z*(ga - gc - ge + gg) + u.z*u.x*(ga - gb - ge + gf)
         + u.x*u.y*u.z*(-ga + gb + gc - gd + ge - gf - gg + gh)
         + du*(vec3(vb - va, vc - va, ve - va) + u.yzx*vec3(k1, k2, k3) + u.zxy*vec3(k3, k1, k2) + u.yzx*u.zxy*k4);
  return 1.55*vec4(v, g);
}

// 27-cell cellular noise: F1/F2/F3, vectors to the two nearest feature points, their cell hashes
void elVor(vec3 p, out float f1, out float f2, out float f3, out vec3 r1, out vec3 r2, out float id1, out float id2){
  vec3 ip = floor(p), fp = fract(p);
  float d1 = 8.0, d2 = 8.0, d3 = 8.0;
  r1 = vec3(0.0); r2 = vec3(0.0); id1 = 0.0; id2 = 0.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 o = h33(ip + g);
    vec3 r = g + o - fp;
    float d = dot(r, r);
    if (d < d1){ d3 = d2; d2 = d1; r2 = r1; id2 = id1; d1 = d; r1 = r; id1 = h13(ip + g); }
    else if (d < d2){ d3 = d2; d2 = d; r2 = r; id2 = h13(ip + g); }
    else if (d < d3){ d3 = d; }
  }
  f1 = sqrt(d1); f2 = sqrt(d2); f3 = sqrt(d3);
}
// cheap 8-cell cellular noise (jitter-limited) for crystals and crazing
void elCell8(vec3 p, out float f1, out float f2, out vec3 r1, out vec3 r2, out float id){
  vec3 b = floor(p - 0.5);
  float d1 = 9.0, d2 = 9.0;
  r1 = vec3(0.0); r2 = vec3(0.0); id = 0.0;
  for (int k = 0; k < 2; k++) for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++){
    vec3 c = b + vec3(float(i), float(j), float(k));
    vec3 r = c + 0.5 + (h33(c) - 0.5)*0.62 - p;
    float d = dot(r, r);
    if (d < d1){ d2 = d1; r2 = r1; d1 = d; r1 = r; id = h13(c + 9.1); }
    else if (d < d2){ d2 = d; r2 = r; }
  }
  f1 = sqrt(d1); f2 = sqrt(d2);
}
// glowing fracture lines from the 8-cell noise. ed = distance to the seam along the surface (energy-preserving mask when
// sub-pixel); gdT = unit direction pointing away from the seam in the tangent plane (for bevels)
float elCrack(vec3 q, vec3 n, float cw, float fw, out vec3 gdT, out float ed, out float cid){
  float f1, f2; vec3 r1, r2;
  elCell8(q, f1, f2, r1, r2, cid);
  vec3 gd = r1/max(f1, 1e-4) - r2/max(f2, 1e-4);
  gdT = gd - n*dot(gd, n);
  float gl = max(length(gdT), 0.3);
  ed = (f2 - f1)*2.0/gl;
  gdT /= gl;
  return (1.0 - smoothstep(0.0, cw + fw, ed))*pow(cw/(cw + fw), 0.6);
}

// faceted crystal field on one lattice scale: returns coverage, adds emission (inner glow, rim, glints) and normal tilt
float elCrystals(vec3 p, vec3 V, vec3 sunB, float FQ, float lodq, vec3 seedO, float clump, float rBase,
                 vec3 cy, vec3 vi, vec3 cyH, vec3 viH, float hueF, float phos, inout vec3 emit, inout vec3 tilt){
  float c1, c2, cid; vec3 cr1, cr2;
  elCell8(p*FQ + seedO, c1, c2, cr1, cr2, cid);
  vec3 aT = -cr1; aT -= p*dot(aT, p);
  vec3 ce1 = normalize(cross(p, h33(vec3(cid*71.3, cid*29.1, 4.0)) - 0.5));       // per-crystal tangent basis
  vec3 ce2 = cross(p, ce1);
  vec3 lean = h33(vec3(cid*17.3, cid*5.1, 3.0)) - 0.5; lean -= p*dot(lean, p);
  float sides = 5.0 + floor(h11(cid*13.7)*2.0);
  float a0 = h11(cid*57.3)*6.2831853;
  float ang = atan(dot(aT, ce2), dot(aT, ce1) + 1e-6) - a0;
  float seg = 6.2831853/sides;
  float fi = floor(ang/seg + 0.5);
  float da = ang/seg - fi;                              // −0.5..0.5 across a facet
  float aL = length(aT);
  float dpoly = aL*cos(da*seg);
  float rin = (rBase + 0.20*h11(cid*3.9))*(0.40 + 0.60*clump);
  float fadeC = 1.0 - smoothstep(0.12, 0.40, lodq);
  float cov = (1.0 - smoothstep(rin - max(0.02, lodq), rin, dpoly))*fadeC;
  float aq = fi*seg + a0;
  vec3 fdir = ce1*cos(aq) + ce2*sin(aq);
  float s1 = 0.8 + 0.5*h11(cid*7.7);
  float zone = smoothstep(0.50*rin, 0.60*rin, dpoly);
  vec3 ft = fdir*mix(s1, s1*2.4, zone) + lean*0.7;      // facet tilt: steep prism walls under a pyramid cap
  tilt += ft*cov;
  vec3 nF = normalize(p + ft);
  float rim = pow(1.0 - max(dot(nF, V), 0.0), 2.0);     // glass-like: thicker path (brighter) at grazing facets
  float ringG = 1.0 - smoothstep(0.0, 0.07*rin, abs(dpoly - 0.55*rin));
  float edgeG = smoothstep(0.42, 0.5, abs(da))*(1.0 - zone*0.3);
  float tip = exp(-aL/(rin*0.35));
  float facB = 0.10 + 0.90*h11(fi + cid*31.0);
  float cs = step(0.55, fract(cid*5.3 + hueF*1.7));
  vec3 ccol = mix(cy, vi, cs), chot = mix(cyH, viH, cs);
  float breathe = 0.75 + 0.25*sin(uTime*0.4 + cid*6.2831853);
  emit *= 1.0 - 0.85*cov;                               // the crystal hides the glass and veins beneath it
  emit += (ccol*facB*(0.14 + 0.40*rim) + chot*(0.28*edgeG + 0.36*ringG + 0.8*tip))*cov*breathe*phos*1.3;
  // facet glint: a mirror facet reflecting the bright core of the galaxy
  float glint = pow(max(dot(reflect(-V, nF), sunB), 0.0), 60.0)*smoothstep(-0.1, 0.3, dot(p, sunB));
  emit += uSunRad*0.45*glint*cov;
  float pool = (1.0 - cov)*exp(-max(dpoly - rin, 0.0)/(0.45*rin))*fadeC;      // light spilling on the glass around a crystal
  emit += ccol*pool*0.10*breathe*phos;
  return cov;
}

Surf surfaceAt(vec3 p, vec3 sunB, float lod){
  Surf s = surfDefault(p);
  vec3 so = vec3(uP0.x*1.37, uP0.x*0.71, -uP0.x*0.43);
  vec3 cy = uP1.rgb, vi = uP2.rgb;
  vec3 cyH = mix(cy, vec3(0.88, 1.0, 1.0), 0.18), viH = mix(vi, vec3(0.96, 0.88, 1.0), 0.15);
  float mu = dot(p, sunB);
  vec3 camB = -vec3(dot(uC, uAx), dot(uC, uAy), dot(uC, uAz));      // camera position in body coordinates
  vec3 Vv = normalize(camB - p);                                    // unit vector surface → camera
  float nv = max(dot(p, Vv), 0.0);                                  // cosine between the surface normal and the view direction

  // ── large-scale fields ───────────────────────────────────────────────────────
  vec3 qa = p*1.7 + so;
  vec3 w = vec3(sn(qa + 11.0), sn(qa + 23.0), sn(qa + 37.0));
  float gm = smoothstep(0.50, 0.62, fbmL(p*2.1 + so*0.5 + w*0.40 + 5.0, 4, lod*2.1));      // crystal gardens
  {   // the Glass Garden (lat −25°, lon −48°) is always a garden
    float gAng = acos(clamp(dot(p, vec3(0.606, -0.673, -0.423)), -1.0, 1.0));
    gm = max(gm, 1.0 - smoothstep(0.10, 0.30, gAng + 0.10*w.x));
  }
  float hueF = fbmL(p*2.7 + so + w*0.30 + 31.0, 3, lod*2.7);
  float crz = smoothstep(0.46, 0.60, fbmL(p*3.3 + so*0.8 + 83.0, 3, lod*3.3));              // crazed regions
  float dust = smoothstep(0.1, 0.6, sn(p*4.1 + so + 71.0));                                   // dull patches of the glass
  float act = smoothstep(-0.30, 0.30, sn(p*1.6 + so*0.4 + 101.0));                           // active highlands vs quiet maria

  // phosphorescence: strongest where the galaxy does not shine; slow travelling pulses
  float night = 1.0 - smoothstep(-0.30, 0.55, mu);
  float phos = mix(0.72, 1.0, night);
  float ph = sn(p*2.3 + so + 17.0);
  float pulse = 0.80 + 0.20*sin(ph*12.0 - uTime*0.30);
  float pulse2 = 0.70 + 0.30*sin(ph*7.0 + uTime*0.22 + 2.0);

  vec3 emit = vec3(0.0);
  vec3 tilt = vec3(0.0);
  float bevFade = 1.0 - smoothstep(0.004, 0.02, lod);

  // deep phosphor glow under the glass
  emit += mix(cy, vi, smoothstep(0.35, 0.65, hueF))*(0.008 + 0.020*crz + 0.030*gm)*phos;

  // ── primary plates: irregular cells; every seam glows, some far brighter ─────
  float f1, f2, f3, id1, id2; vec3 r1, r2;
  elVor(p*EL_FP + so + w*0.40, f1, f2, f3, r1, r2, id1, id2);
  vec3 gd = r1/max(f1, 1e-4) - r2/max(f2, 1e-4);
  vec3 gdT = gd - p*dot(gd, p);
  float gl = max(length(gdT), 0.3);
  float ed = (f2 - f1)*2.0/gl;                          // distance to the plate boundary along the surface
  float fw = lod*EL_FP*1.6;                             // pixel footprint in plate units
  float seam = fract(id1 + id2 + 0.37);                 // symmetric per-edge hash
  float segB = mix(0.12, 1.0, smoothstep(0.0, 1.0, fract(seam*13.17 + 0.5)))*mix(0.18, 1.0, act);
  float cw = (0.011 + 0.022*fract(seam*29.3))*(1.0 + 0.9*gm);
  float lineA = pow(cw/(cw + fw), 0.6);
  float core = (1.0 - smoothstep(0.0, cw + fw, ed))*lineA;
  float hal = exp(-ed/(0.045 + fw*0.6))*lineA;
  float broad = exp(-ed/0.22);
  float node = (1.0 - smoothstep(0.0, 0.10 + fw, f3 - f1))*lineA;
  float vsel = smoothstep(0.38, 0.62, hueF + (seam - 0.5)*0.6);
  vec3 vcol = mix(cy, vi, vsel), vhot = mix(cyH, viH, vsel);
  emit += (vhot*(core*1.3 + node*0.55) + vcol*(hal*0.34 + broad*0.035))*segB*pulse*phos;
  tilt += (gdT/gl)*0.08*exp(-ed/0.10)*bevFade;
  vec3 r1T = r1 - p*dot(r1, p);
  tilt -= r1T*0.14*(1.0 - smoothstep(0.3, 0.9, fw));              // convex, pillowed plates: the galaxy's reflection pools inside each plate

  // ── secondary cracks (crazed regions and gardens) ────────────────────────────
  float fw2 = lod*EL_FP2*1.6;
  float m2 = max(crz, gm*0.55)*(0.35 + 0.65*act);
  if (m2 > 0.02 && fw2 < 0.8){
    vec3 g2; float ed2, cid2;
    float c2 = elCrack(p*EL_FP2 + so*2.3 + w*0.8, p, 0.030, fw2, g2, ed2, cid2)*m2*(1.0 - smoothstep(0.35, 0.8, fw2));
    emit += mix(cy, vi, step(0.7, cid2))*c2*0.6*mix(0.35, 1.0, cid2)*pulse*phos;
    tilt += g2*0.07*exp(-ed2/0.10)*m2*bevFade;
  }
  // ── hairline craze ───────────────────────────────────────────────────────────
  float fw3 = lod*EL_FP3*1.6;
  float m3 = max(crz*0.5, gm*0.7);
  if (m3 > 0.02 && fw3 < 0.8){
    vec3 g3; float ed3, cid3;
    float c3 = elCrack(p*EL_FP3 + so*4.1 + 19.0, p, 0.035, fw3, g3, ed3, cid3)*m3*(1.0 - smoothstep(0.35, 0.8, fw3));
    emit += mix(cy, vi, step(0.5, cid3))*c3*0.28*pulse*phos;
    tilt += g3*0.04*exp(-ed3/0.10)*m3*bevFade;
  }

  // ── long rivers: constant-width zero-contours of warped noise ────────────────
  vec3 qr = p*1.7 + so*0.7 + w*0.6 + 57.0;
  vec4 rn = elSnd(qr), rn2 = elSnd(qr*2.3 + 5.0);
  float rg = length(rn.yzw + 0.805*rn2.yzw);
  float rd = abs(rn.x + 0.35*rn2.x)/max(rg, 0.9);       // distance estimate to the contour (noise units)
  float rW = 0.010, fwr = lod*1.7*1.6;
  float rm = smoothstep(-0.25, 0.35, sn(p*3.5 + so + 41.0))*(0.25 + 0.75*smoothstep(-0.2, 0.45, sn(p*9.0 + so + 63.0)))*(0.30 + 0.70*smoothstep(0.7, 1.8, rg));
  float riv = (1.0 - smoothstep(0.0, rW + fwr, rd))*pow(rW/(rW + fwr), 0.6)*rm;
  float rhal = exp(-rd/(0.035 + fwr))*pow(0.035/(0.035 + fwr), 0.6)*rm;
  emit += (mix(viH, vec3(0.95, 0.9, 1.0), 0.2)*riv*1.15 + vi*rhal*0.26)*pulse2*phos;

  // ── gardens: luminous undergrowth ────────────────────────────────────────────
  float grain = 0.0;
  if (gm > 0.02 && lod < 0.02) grain = smoothstep(0.55, 0.85, fbmL(p*48.0 + so, 3, lod*48.0));
  emit += mix(cy, vi, smoothstep(0.35, 0.65, hueF))*gm*(0.025 + 0.10*grain)*phos;

  // ── crystal spires: two scales of leaning hexagonal pyramids ─────────────────
  float crysIn = 0.0;
  float clumpA = gm*smoothstep(-0.15, 0.35, sn(p*6.0 + so + 5.0));
  if (clumpA > 0.02 && lod*22.0 < 0.4)
    crysIn = elCrystals(p, Vv, sunB, 22.0, lod*22.0, so*3.0, clumpA, 0.22, cy, vi, cyH, viH, hueF, phos, emit, tilt);
  float clumpB = gm*smoothstep(-0.10, 0.40, sn(p*11.0 + so + 15.0));
  if (clumpB > 0.02 && lod*64.0 < 0.4){
    vec3 emitB = vec3(0.0), tiltB = vec3(0.0);
    float cb = elCrystals(p, Vv, sunB, 64.0, lod*64.0, so*5.0 + 7.0, clumpB, 0.16, cy, vi, cyH, viH, hueF, phos, emitB, tiltB)*(1.0 - crysIn);
    emit = emit*(1.0 - 0.85*cb) + emitB*(1.0 - crysIn); tilt += tiltB*(1.0 - crysIn);
    crysIn = max(crysIn, cb);
  }

  // ── normal: glassy undulation (analytic slopes) + per-plate tilt + bevels + crystals ──
  vec4 u1 = elSnd(p*3.1 + so*0.6 + 3.0);
  tilt += u1.yzw*0.026;
  float uf = 1.0 - smoothstep(0.15, 0.4, lod*7.3);
  if (uf > 0.0){ vec4 u2 = elSnd(p*7.3 + so + 9.0); tilt += u2.yzw*0.011*uf; }
  vec3 pt = h33(vec3(id1*37.1, id1*11.3, 5.0)) - 0.5;
  tilt += pt*0.02;
  tilt -= p*dot(tilt, p);
  s.nrm = normalize(p + tilt);

  // ── crust: very dark glass, glossy; crystals are paler and glassier ──────────
  vec3 crust = uP3.rgb*(0.12 + 0.22*h11(id1*91.7));
  s.albedo = mix(crust, vec3(0.035, 0.07, 0.10), crysIn*0.8);
  s.spec = 1.3*mix(0.85, 0.50, dust)*(1.0 - 0.6*core)*mix(0.45, 1.0, smoothstep(0.0, 0.4, nv)) + 0.05*crysIn;
  s.rough = mix(0.05, 0.22, dust) - 0.02*crysIn;

  // soft-knee limit: keep emission ≲ 1.5
  s.emit = 1.5*(vec3(1.0) - exp(-emit*uP0.y/1.5));
  return s;
}
`,
};
