// Phlegethon — tidally heated iron world. Black basalt plains split into young flows and weathered plateau by crisp units; meandering lava
// rivers (contours of a domain-warped field) run along plateau scarps; crust plates glow in their cracks; calderas hold crusted lava lakes with
// sulphur / SO2 aprons; rust streaks, pits and glowing vents; pale sulphur dusting over the poles. Lava is emissive on both hemispheres
// (brightened a little in daylight to out-shine the ash haze) and breathes slowly with uTime. Near range adds crust cracks, grain and bump relief.
// uP0 = (seed, emission gain, pulse rate [rad/s], basalt albedo scale)   uP1 = (frost amount, rust amount, activity bias, lava width scale)   uP2.xyz = weathered basalt colour
export default {
  id: 'phlegethon',
  defines: {},
  params: (look) => ({
    uP0: [look.seed ?? 7.7, 1.0, 0.11, (look.albedo ?? 0.07)/0.07],
    uP1: [1.0, 1.0, 0.0, 1.0],
    uP2: [...(look.color ?? [0.10, 0.07, 0.06]), 0],
  }),
  glsl: /* glsl */ `
// black-body-ish lava ramp: T 0 = cold crust … 1 = white-hot (display units, ≲ 1.5)
vec3 phLava(float T){
  vec3 c = vec3(0.0);
  c = mix(c, vec3(0.42, 0.018, 0.000), smoothstep(0.02, 0.24, T));
  c = mix(c, vec3(1.00, 0.16, 0.010), smoothstep(0.20, 0.52, T));
  c = mix(c, vec3(1.15, 0.48, 0.045), smoothstep(0.48, 0.76, T));
  c = mix(c, vec3(1.30, 0.86, 0.280), smoothstep(0.72, 0.95, T));
  c = mix(c, vec3(1.42, 1.22, 0.850), smoothstep(0.93, 1.25, T));
  return c;
}
// soft hump around d = 0 (half-width w); sub-pixel humps widen to a pixel and dim, so thin features never alias
float phBand(float d, float w, float px){
  float ww = max(w, px);
  return (1.0 - smoothstep(0.0, ww, d))*(w/ww);
}
// crisp anti-aliased band |d| < w
float phSolid(float d, float w, float px){
  float ww = max(w, px);
  return (1.0 - smoothstep(ww - px, ww + px, d))*(w/ww);
}
// angular crack network: edges of a cheap cellular pattern (the 2x2x2 cells nearest the point); x = F2 - F1 (≈ 0 on a crack), y = per-edge hash
vec2 phEdge(vec3 P){
  vec3 ip = floor(P), fp = P - ip;
  vec3 sg = step(0.5, fp)*2.0 - 1.0;
  float f1 = 9.0, f2 = 9.0;
  vec3 c1 = ip, c2 = ip;
  for (int k = 0; k < 2; k++) for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++){
    vec3 g = vec3(float(i), float(j), float(k))*sg;
    vec3 r = g + 0.1 + 0.8*h33(ip + g) - fp;
    float d = dot(r, r);
    if (d < f1){ f2 = f1; c2 = c1; f1 = d; c1 = ip + g; } else if (d < f2){ f2 = d; c2 = ip + g; }
  }
  return vec2(sqrt(f2) - sqrt(f1), h13(c1 + c2 + 3.3));
}
// cracks as coverage: every edge has its own width, and some stay closed
float phCracks(vec3 q, float fq, float lod, float w){
  vec2 e = phEdge(q);
  return phBand(e.x, w*(0.55 + 0.9*e.y), lod*fq*2.0)*smoothstep(0.20, 0.45, e.y);
}
// molten fraction of a lava surface: x = 0 hot centre … 1 cold margin, m = blotchy noise, ck = crack coverage on the crust plates
float phLavaFac(float x, float m, float ck){
  float thr = mix(0.14, 0.80, x*x*(3.0 - 2.0*x));
  float mol = smoothstep(thr - 0.045, thr + 0.045, m);
  return mol*(0.80 + 0.35*m) + (1.0 - mol)*(0.12 + 0.95*ck);
}
// gradient noise with analytic gradient: (value ≈ [-1,1], d/dp)
vec4 phSnd(vec3 p){
  vec3 i = floor(p), w = fract(p);
  vec3 u = w*w*w*(w*(w*6.0 - 15.0) + 10.0);
  vec3 du = 30.0*w*w*(w*(w - 2.0) + 1.0);
  vec3 ga = h33(i)*2.0 - 1.0, gb = h33(i + vec3(1.0, 0.0, 0.0))*2.0 - 1.0, gc = h33(i + vec3(0.0, 1.0, 0.0))*2.0 - 1.0, gd = h33(i + vec3(1.0, 1.0, 0.0))*2.0 - 1.0;
  vec3 ge = h33(i + vec3(0.0, 0.0, 1.0))*2.0 - 1.0, gf = h33(i + vec3(1.0, 0.0, 1.0))*2.0 - 1.0, gg = h33(i + vec3(0.0, 1.0, 1.0))*2.0 - 1.0, gh = h33(i + vec3(1.0, 1.0, 1.0))*2.0 - 1.0;
  float va = dot(ga, w), vb = dot(gb, w - vec3(1.0, 0.0, 0.0)), vc = dot(gc, w - vec3(0.0, 1.0, 0.0)), vd = dot(gd, w - vec3(1.0, 1.0, 0.0));
  float ve = dot(ge, w - vec3(0.0, 0.0, 1.0)), vf = dot(gf, w - vec3(1.0, 0.0, 1.0)), vg = dot(gg, w - vec3(0.0, 1.0, 1.0)), vh = dot(gh, w - vec3(1.0, 1.0, 1.0));
  float k1 = va - vb - vc + vd, k2 = va - vc - ve + vg, k3 = va - vb - ve + vf, k4 = -va + vb + vc - vd + ve - vf - vg + vh;
  float v = va + u.x*(vb - va) + u.y*(vc - va) + u.z*(ve - va) + u.x*u.y*k1 + u.y*u.z*k2 + u.z*u.x*k3 + u.x*u.y*u.z*k4;
  vec3 g = ga + u.x*(gb - ga) + u.y*(gc - ga) + u.z*(ge - ga) + u.x*u.y*(ga - gb - gc + gd) + u.y*u.z*(ga - gc - ge + gg) + u.z*u.x*(ga - gb - ge + gf)
         + u.x*u.y*u.z*(-ga + gb + gc - gd + ge - gf - gg + gh)
         + du*(vec3(vb - va, vc - va, ve - va) + u.yzx*vec3(k1, k2, k3) + u.zxy*vec3(k3, k1, k2) + u.yzx*u.zxy*k4);
  return 1.55*vec4(v, g);
}
// near-range relief: three octaves of gradient noise → (height, gradient w.r.t. p); octaves finer than a pixel fade out
vec4 phRelief(vec3 p, float lod){
  vec4 a = phSnd(p*17.0 + 3.1);
  vec4 b = phSnd(p*47.0 + 4.7);
  vec4 c = phSnd(p*131.0 + 9.2);
  float wb = 1.0 - smoothstep(0.35, 0.95, 47.0*lod);
  float wc = 1.0 - smoothstep(0.35, 0.95, 131.0*lod);
  float h = 0.50*a.x + 0.22*wb*b.x + 0.09*wc*c.x;
  vec3 g = 0.50*17.0*a.yzw + 0.22*47.0*wb*b.yzw + 0.09*131.0*wc*c.yzw;
  return vec4(h, g);
}
// cellular noise returning F1, F2, the vectors point→nearest / second feature, the pair id (symmetric) and the nearest cell hash
vec2 phVor(vec3 P, out vec3 r1o, out vec3 r2o, out vec3 csO, out float idO){
  vec3 ip = floor(P), fp = P - ip;
  float f1 = 9.0, f2 = 9.0;
  vec3 b1 = vec3(0.0), b2 = vec3(0.0), c1 = ip, c2 = ip;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 r = g + h33(ip + g) - fp;
    float d = dot(r, r);
    if (d < f1){ f2 = f1; b2 = b1; c2 = c1; f1 = d; b1 = r; c1 = ip + g; }
    else if (d < f2){ f2 = d; b2 = r; c2 = ip + g; }
  }
  r1o = b1; r2o = b2; csO = c1 + c2; idO = h13(c1);
  return vec2(sqrt(f1), sqrt(f2));
}

Surf surfaceAt(vec3 p, vec3 sunB, float lod){
  Surf s = surfDefault(p);
  float sd = uP0.x;
  vec3 so = vec3(sd*1.713, sd*0.917, -sd*0.531);
  float wS = 1.0 - smoothstep(0.0012, 0.0045, lod);                 // flow-streak visibility (near range)
  float wG = 1.0 - smoothstep(0.004, 0.015, lod);                   // ground banding / outlines visibility

  // ── macro fields ─────────────────────────────────────────────────────────
  float prov = fbmL(p*1.3 + so, 3, lod*1.3) + uP1.z - 0.14*p.z*p.z;
  float act = smoothstep(0.34, 0.60, prov);                       // volcanic provinces (quieter towards the poles)
  float hot = smoothstep(0.46, 0.74, prov);                       // the hottest provinces: lava fields
  float tone = fbmL(p*4.1 + so*0.5 + 9.0, 2, lod*4.1);
  float breath = 0.88 + 0.12*sin(uTime*uP0.z + 9.0*prov);        // slow pulse, out of phase from province to province

  // ── lava rivers: contours of a domain-warped field (plateau one side, flooded plain the other) ──
  vec3 qr = p*2.3 + so*0.6;
  vec3 wv = vec3(sn(qr*0.85 + 4.1), sn(qr*0.85 + 13.7), sn(qr*0.85 + 27.3));
  vec3 qw = qr + wv*0.8;
  vec4 f0 = phSnd(qw);
  float fr = f0.x + 0.40*sn(qw*2.3 + 9.0);
  float rt = fbmL(qw*4.3 + 3.1, 2, lod*9.9);                      // along-river variation: pools, hot and cold stretches
  float rs = smoothstep(0.30, 0.70, rt);
  float bank = sn(qw*7.7 + 1.3);                                  // ragged banks
  float dB = abs(fr) + 0.03*bank;
  float pxR = lod*9.0;
  float pool = smoothstep(0.62, 0.84, rt);                        // rare wide pools: lava lakes in the river course
  float wr = 0.060*uP1.w*(0.50 + 0.85*act)*(0.55 + 1.0*smoothstep(0.28, 0.74, rt))*(1.0 + 1.6*pool);
  float covR = phSolid(dB, wr, pxR);
  float xr = clamp(dB/max(wr, pxR), 0.0, 1.0);
  float spill = phBand(dB, wr*3.0, pxR*1.5)*(0.3 + 0.7*act);     // ground lit by the lava
  float stk = sn(vec3(fr*30.0, wv.x*1.6 + 3.1, wv.y*1.6 - 1.3));  // flow banding: stripes along the river
  float tube = smoothstep(0.54, 0.64, 0.5 + 0.5*sn(qw*3.1 + 17.3))*(1.0 - pool);   // roofed stretches: crusted over, dull red
  // tributaries: a thinner contour field that only exists near the main rivers
  float d2 = abs(sn(qw*3.4 + 5.5)) + 0.02*bank;
  float cov2 = phSolid(d2, 0.035*uP1.w, lod*2.3*3.4*4.0)*(1.0 - smoothstep(0.15, 0.80, dB))*(0.35 + 0.65*act);

  // ── crust plates, cracks and grain (near range) ──────────────────────────
  float ckR = 0.16, mR = 0.5, ember = 0.0, fleck = 0.0, ckG = 0.0;
  if (lod < 0.012) mR = fbmL(p*62.0 + wv*2.5 + so + 2.2, 2, lod*62.0);
  float det = mR;                                                   // grain / blotch noise shared by the lava crust and the ground
  float rag = det - 0.5;
  // crisp geological units: young black flows (cracked, glowing) vs weathered plateau
  float plat = smoothstep(-0.05, 0.50, fr);
  float gs = sn(vec3(fr*9.0 + 2.2, wv.y*1.3 + 7.0, wv.z*1.3));      // flow-aligned banding of the ground
  float eU = 0.008 + lod*6.0;
  float zone = tone + 0.28*(plat - 0.5) + 0.12*rag + 0.07*gs*wG;
  float old = smoothstep(0.50 - eU, 0.50 + eU, zone);
  float young = 1.0 - old;
  if (lod < 0.03) ember = phCracks(p*15.0 + wv*1.2 + so + 4.4, 15.0, lod, 0.11)*act*(0.25 + 0.75*hot)*(0.30 + 0.70*young);   // glowing crack web
  if (lod < 0.006) ckG = phCracks(p*34.0 + wv*2.0 + so + 7.7, 34.0, lod, 0.05);                         // cracked basalt crust
  if (lod < 0.012) ckR = phCracks(p*52.0 + wv*3.0 + so, 52.0, lod, 0.07);
  if (lod < 0.0035) ckR = max(ckR, 0.8*phCracks(p*150.0 + wv*5.0 + so + 8.8, 150.0, lod, 0.08));
  if (lod < 0.0012) fleck = sn(p*310.0 + so + 3.3)*(1.0 - smoothstep(0.0006, 0.0012, lod));

  // ── cells: crust plates, fissures ────────────────────────────────────────
  const float VK = 9.0;
  float jf = 1.0 - smoothstep(0.008, 0.016, lod);
  vec3 jag = vec3(0.0);
  if (jf > 0.0){ float j1 = sn(p*19.0 + so), j2 = sn(p*19.0 + 7.3); jag = vec3(j1, j2, 0.7*(j2 - j1))*(0.14*jf); }
  vec3 r1 = vec3(0.0), r2 = vec3(0.0), cs = vec3(0.0);
  float vid = 0.0;
  vec2 vf = phVor(p*VK + so*0.37 + wv*0.45 + jag, r1, r2, cs, vid);
  float ed = vf.y - vf.x;
  float eh = h13(cs*1.37 + 5.0);
  float liveE = smoothstep(0.0, 0.12, eh - (0.80 - 0.58*act));
  float segF = smoothstep(0.30, 0.62, 0.5 + 0.5*sn(p*11.0 + eh*53.0));
  float wf = 0.030, pxF = lod*VK*2.0;
  float covF = phSolid(ed, wf, pxF)*liveE*segF;
  float xf = clamp(ed/max(wf, pxF), 0.0, 1.0);
  float Tf = (0.40 + 0.50*h11(eh*37.0))*(0.75 + 0.5*rt)*(1.0 - 0.5*xf);
  Tf *= phLavaFac(xf, mR, ckR)*0.9;

  // ── calderas / lava lakes: one jittered feature per cell of a coarse 3D grid (kept inside its cell: no seams) ──
  float nz = fbmL(p*23.0 + so + 5.0, 2, lod*23.0);
  vec3 Pc = p*3.2 + so*0.29;
  vec3 ci = floor(Pc);
  vec3 dv = Pc - (ci + 0.34 + 0.32*h33(ci + 3.7));
  float Fc = length(dv);
  float cid = h13(ci + 11.3);
  float Rc = 0.11 + 0.12*cid*cid;
  float moltenC = step(0.22, h11(cid*71.3 + 2.1));
  float pxC = lod*3.2;
  float Rl = max(Rc*0.82, pxC);
  float Fr = Fc + 0.5*Rc*(nz - 0.5);
  float covL = phSolid(Fr, Rl, pxC);
  float xl = clamp(Fr/Rl, 0.0, 1.0);
  float Tl = moltenC*(0.55 + 0.45*(1.0 - xl))*(0.8 + 0.4*rt)*(0.93 + 0.07*sin(uTime*0.07 + cid*40.0));
  Tl *= phLavaFac(xl, mR, ckR);
  float wall = smoothstep(min(Rl*0.85, Rc), Rc*1.05, Fc)*(1.0 - smoothstep(Rc*1.05, Rc*1.45, Fc));

  // plume deposits around the vent: sulphur yellow, SO2 white or a red-brown apron (per vent), irregular fans
  float fanA = 0.5 + 0.5*sn(dv/max(Fc, 1e-4)*2.7 + cid*31.0);
  float hr = clamp((Fc - Rc*0.9)/(0.33 - Rc*0.9), 0.0, 1.0)/(0.60 + 0.8*fanA);
  float halo = (1.0 - smoothstep(0.40, 1.0, hr + 0.55*(0.5 - nz)))*(1.0 - covL)*(1.0 - smoothstep(0.24, 0.33, Fc));
  float kind = h11(cid*19.7 + 8.8);

  // ── small pits and vents (near range) ────────────────────────────────────
  float pit = 0.0, pitRim = 0.0, pitHot = 0.0, pitT = 0.0;
  if (lod < 0.004){
    vec3 Pp = p*57.0 + so*0.7;
    vec3 cp = floor(Pp);
    vec3 dp = Pp - (cp + 0.3 + 0.4*h33(cp + 1.7));
    float Fp = length(dp), hp = h13(cp + 5.1);
    float Rp = 0.07 + 0.13*hp*hp;
    float pxP = lod*57.0;
    pit = phSolid(Fp, Rp, pxP);
    pitRim = phSolid(abs(Fp - Rp*1.25), Rp*0.30, pxP);
    pitHot = pit*step(0.90 - 0.22*hot, h13(cp + 9.3));
    pitT = (0.30 + 0.65*h11(hp*53.0 + 3.0))*(1.0 - 0.45*clamp(Fp/Rp, 0.0, 1.0));
  }

  // ── albedo: crisp geological units (young black flows, weathered plateau), rust, frost ──
  vec3 youngC = vec3(0.040, 0.038, 0.041)*(0.6 + 0.8*det)*uP0.w;
  vec3 agedC = uP2.xyz*0.92*(0.6 + 0.8*det)*uP0.w;
  vec3 alb = mix(youngC, agedC, old);
  alb *= 1.0 + 0.55*wG*(1.0 - smoothstep(0.0, 2.2*eU, abs(zone - 0.5)));    // lit flow fronts outline the units
  alb *= 0.62 + 0.38*smoothstep(wr, wr*4.0, dB);                    // baked, dark margin beside the channels
  float scarp = phBand(abs(fr - 0.30), 0.05, pxR);                   // plateau scarp: a shadowed step above the flooded plain
  alb *= 1.0 - 0.45*scarp*(1.0 - 0.5*old);
  float rn = fbmL(p*8.0 + wv*1.3 + so, 1, lod*8.0);
  float eR = 0.01 + lod*12.0;
  float rust = smoothstep(0.55 - eR, 0.55 + eR, rn + 0.12*rag + 0.20*gs*wG)*(0.25 + 0.75*old)*uP1.y;   // iron-oxide streaks run with the flow
  alb = mix(alb, vec3(0.23, 0.085, 0.035)*(0.75 + 0.5*det), rust);
  // frost: broad rare blotches, vent aprons and the flanks of live fissures
  float fz = 0.5 + 0.5*sn(p*5.5 + so + 21.0);
  float eF = 0.02 + lod*7.0;
  float blot = smoothstep(0.70 - eF, 0.70 + eF, fz + 0.25*(nz - 0.5) + 0.12*rag)*(0.4 + 0.6*act);
  vec3 sulph = vec3(0.62, 0.48, 0.10);
  vec3 frostW = vec3(0.50, 0.48, 0.42);
  alb = mix(alb, mix(sulph, frostW, smoothstep(0.55, 0.80, nz))*(0.8 + 0.4*det), blot*0.85*uP1.x);
  float eF2 = 0.03 + lod*7.0;
  float frostP = smoothstep(0.62 - eF2, 0.62 + eF2, nz + 0.45*(1.0 - hr) + 0.25*rag);
  vec3 apron = kind < 0.40 ? sulph : (kind < 0.62 ? frostW : vec3(0.26, 0.085, 0.035));
  alb = mix(alb, apron*(0.8 + 0.4*nz), halo*frostP*uP1.x*step(kind, 0.80));
  float flank = (1.0 - smoothstep(0.02, 0.07 + 0.05*(nz - 0.5), ed))*liveE*segF*smoothstep(0.45, 0.60, nz + 0.2*rag);
  alb = mix(alb, sulph*(0.7 + 0.5*nz), flank*0.8*uP1.x);
  // polar sulphur / SO2 dusting
  float polar = smoothstep(0.74, 0.94, abs(p.z) + 0.16*(tone - 0.5) + 0.10*(nz - 0.5))*uP1.x;
  alb = mix(alb, mix(vec3(0.52, 0.45, 0.20), frostW, smoothstep(0.55, 0.80, nz))*(0.8 + 0.4*det), polar*0.65);
  alb = mix(alb, alb*0.45, wall);
  alb *= 1.0 - (0.30 + 0.35*young)*ckG;
  alb *= 1.0 + 0.36*(h11(vid*91.7 + 1.3) - 0.5)*(1.0 - smoothstep(0.003, 0.010, lod));   // crust plates differ in tone
  alb *= (1.0 + 0.35*fleck)*(1.0 - 0.55*pit + 0.6*pitRim*(1.0 - pit));   // rubble grain, dark pits with lit rims
  float lava = clamp(max(max(max(covR, covF), max(covL, cov2)), pitHot)*1.2, 0.0, 1.0);
  alb = mix(alb, vec3(0.020), lava);

  // ── emission ─────────────────────────────────────────────────────────────
  float day = smoothstep(-0.15, 0.55, dot(p, sunB));                // lava has to out-shine the sunlit ash haze
  float Tcore = min(mix(0.52, 0.92, act)*(0.62 + 0.75*rs), 0.98);
  float Tchan = Tcore*(1.0 - 0.40*xr*xr)*(1.0 + 0.22*stk*wS)*mix(1.0, 0.32, tube)*(0.90 + 0.20*sin(uTime*0.16 + 17.0*rt));
  float Tr = Tchan*phLavaFac(xr, mR, ckR);
  vec3 E = phLava(Tr)*covR + phLava(Tf)*covF + phLava(Tl)*covL + phLava(0.55*Tcore*phLavaFac(0.5, mR, ckR))*cov2;
  E += phLava(0.18 + 0.30*hot)*ckG*act*young*(1.0 - lava)*0.9;
  E += phLava(0.32)*ember*(1.0 - lava)*0.8 + phLava(0.14)*spill*(0.35 + 0.9*det);
  E += phLava(0.34)*smoothstep(0.55, 0.80, fleck)*hot*(1.0 - lava)*0.7;
  E += phLava(pitT)*pitHot;
  float front = (1.0 - smoothstep(0.0, 2.2*eU + 0.012, abs(zone - 0.5)))*wG*hot*smoothstep(0.40, 0.60, nz);   // glowing flow fronts
  E += phLava(0.24)*front*(1.0 - lava)*0.6;
  E += phLava(0.22 + 0.25*hot)*act*(0.2 + 0.8*hot)*smoothstep(0.012, 0.04, lod)*0.5;     // the unresolved web: hot provinces glow as broad warm areas from afar
  E *= breath*uP0.y*(1.0 + 0.45*day);

  s.albedo = alb;
  s.emit = E*min(1.0, 1.5/max(max(E.r, max(E.g, E.b)), 1e-4));
  s.rough = mix(0.55, 0.30, lava);
  s.spec = 0.06 + 0.30*covL*moltenC;

  // ── relief (near range): fractal micro-relief, levees along the rivers, plate edges, caldera walls ──
  if (lod < 0.0050){
    float rel = (1.0 - smoothstep(0.0030, 0.0050, lod))*(1.0 - 0.75*lava);
    vec4 hd = phRelief(p, lod);
    vec3 g = hd.yzw*0.045;
    // river levees: a raised ridge just outside the channel
    vec3 gf = f0.yzw*sign(fr)*2.3;
    float bU = smoothstep(wr*0.7, wr*1.05, dB)*(1.0 - smoothstep(wr*1.05, wr*1.4, dB));
    float bD = smoothstep(wr*1.4, wr*1.9, dB)*(1.0 - smoothstep(wr*1.9, wr*2.8, dB));
    g += gf*(bU - 0.6*bD)*0.07;
    g += f0.yzw*2.3*(smoothstep(0.12, 0.21, fr)*(1.0 - smoothstep(0.21, 0.30, fr)))*0.05;   // scarp face
    vec3 tv = h33(vec3(vid*17.3, vid*5.1, vid*29.7))*2.0 - 1.0;               // every crust plate sits at its own slight tilt
    g += (tv - p*dot(tv, p))*0.10;
    // plate edges along live fissures
    vec3 gE = r1/max(length(r1), 1e-4) - r2/max(length(r2), 1e-4);
    float xe = clamp(ed/0.035, 0.0, 1.0);
    g += gE*(6.0*xe*(1.0 - xe)/0.035)*VK*0.0008*liveE;
    // caldera wall + rim
    vec3 rad = (dv - p*dot(dv, p))/max(Fc, 1e-4);
    float wb = smoothstep(Rc*0.70, Rc*0.95, Fc)*(1.0 - smoothstep(Rc*0.95, Rc*1.25, Fc));
    g += rad*(wb - 0.15*smoothstep(Rc*1.1, Rc*2.0, Fc)*(1.0 - smoothstep(Rc*2.0, Rc*3.0, Fc))*(1.0 - smoothstep(0.20, 0.30, Fc)))*0.38;
    s.nrm = perturb(p, g*rel);
  }
  return s;
}
`,
};
