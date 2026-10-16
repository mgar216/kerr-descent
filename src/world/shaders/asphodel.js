// Asphodel — tidally locked ocean-archipelago world: turquoise shallows, deep blue seas, black beaches, silver-grey
// meadows, a frozen night side, a cloud deck with swirling storms along the terminator.
// uP0 = (seed, sea level, cloud cover, storm strength)
export default {
  id: 'asphodel',
  defines: { HAS_CLOUDS: 1, CLOUD_H: '0.0035' },
  params: (look) => ({ uP0: [look.seed ?? 3.1, 0.56, 0.36, 0.85, 0] }),
  glsl: /* glsl */ `
float aHeight(vec3 p, float lod){
  vec3 q = p*1.5 + vec3(uP0.x*1.37, uP0.x*0.71, -uP0.x*0.43);
  vec3 w = vec3(sn(q*1.1 + 11.0), sn(q*1.1 + 23.0), sn(q*1.1 + 37.0));
  float h = fbmL(q + w*0.55, 7, lod*1.5);
  float isl = fbmL(q*3.1 + 5.0, 5, lod*4.65);
  return mix(h, isl, 0.30);
}

Surf surfaceAt(vec3 p, vec3 sunB, float lod){
  Surf s = surfDefault(p);
  float sea = uP0.y;
  float h = aHeight(p, lod);
  float d = h - sea;                               // > 0 land
  float mu = dot(p, sunB);                         // cosine of the angle from the sub-Erebus point
  float det3 = fbmL(p*5.0 + 21.0, 4, lod*5.0);
  float cold = smoothstep(0.34, 0.66, 0.5 + (-mu - 0.15)*1.1 + (det3 - 0.5)*1.0 + (fbmL(p*13.0 + 7.0, 4, lod*13.0) - 0.5)*0.5); // the night hemisphere freezes: patchy, ragged edge
  float det  = fbmL(p*17.0 + 3.0, 5, lod*17.0);
  float det2 = fbmL(p*61.0 + 9.0, 3, lod*61.0);
  float isLand = smoothstep(-0.0015, 0.0015, d);

  // ocean: sunlit turquoise sand-bars grading through cobalt to deep indigo
  float dep = clamp(-d/0.075, 0.0, 1.0);
  vec3 water = mix(vec3(0.035, 0.50, 0.47), vec3(0.012, 0.25, 0.40), smoothstep(0.0, 0.25, dep));
  water = mix(water, vec3(0.004, 0.075, 0.24), smoothstep(0.2, 0.65, dep));
  water = mix(water, vec3(0.002, 0.020, 0.095), smoothstep(0.55, 1.0, dep));
  water *= 0.86 + 0.28*det2;
  water += vec3(0.02, 0.06, 0.05)*smoothstep(0.55, 0.9, det)*(1.0 - dep);
  float foam = (1.0 - smoothstep(0.0, 0.007, -d))*(1.0 - isLand);
  water = mix(water, vec3(0.55, 0.62, 0.62), foam*(0.4 + 0.6*det2));

  // land: silver-grey meadows, slate uplands, a thin black-sand strand
  float beach = smoothstep(-0.0015, 0.0015, d)*(1.0 - smoothstep(0.003, 0.012, d + 0.004*det2));
  vec3 sand = vec3(0.014, 0.014, 0.018)*(0.8 + 0.6*det2);
  vec3 grass = mix(mix(vec3(0.22, 0.26, 0.23), vec3(0.43, 0.47, 0.44), det), vec3(0.17, 0.22, 0.22), smoothstep(0.5, 0.8, det3)*0.6);
  grass *= 0.86 + 0.28*det2;
  vec3 rock = mix(vec3(0.17, 0.17, 0.17), vec3(0.34, 0.32, 0.30), det2);
  float hill = smoothstep(0.10, 0.22, d + 0.05*(det - 0.5));
  vec3 land = mix(grass, rock, hill);
  land = mix(land, sand, beach*(0.5 + 0.5*det));
  vec3 alb = mix(water, land, isLand);

  vec3 ice = vec3(0.50, 0.58, 0.66)*(0.85 + 0.25*det)*(1.0 - 0.38*smoothstep(0.80, 0.95, ridgedL(p*7.0 + 13.0, 4, lod*7.0)));
  alb = mix(alb, ice, cold*(0.62 + 0.38*isLand));
  s.albedo = alb;
  s.spec = (1.0 - isLand)*(1.0 - 0.85*cold)*0.95;
  s.rough = 0.06 + 0.07*det2 + 0.25*cold;

  if (isLand > 0.5 && lod < 0.012 && uQuality > 0.5){               // relief from two extra height samples
    vec3 t1 = normalize(cross(p, vec3(0.0, 0.0, 1.0) + vec3(0.013, 0.007, 0.0)));
    vec3 t2 = cross(p, t1);
    float eps = max(lod, 0.0015)*1.5;
    float h1 = aHeight(normalize(p + t1*eps), lod), h2 = aHeight(normalize(p + t2*eps), lod);
    vec3 g = (t1*(h1 - h) + t2*(h2 - h))/eps;
    s.nrm = perturb(p, g*0.55);
  }
  return s;
}

float cDens(vec3 p, vec3 sunB, float lod){
  vec3 e1 = normalize(cross(sunB, abs(sunB.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
  vec3 e2 = cross(sunB, e1);
  vec3 q = p;
  float storm = 0.0, eye = 0.0;
  for (int k = 0; k < 4; k++){
    float fk = float(k);
    float ph = 6.2831853*(fk + 0.37*fk*fk)/4.7 + uP0.x;
    vec3 c = normalize(e1*cos(ph) + e2*sin(ph) + sunB*0.14*(fk - 1.5));
    float a = acos(clamp(dot(q, c), -1.0, 1.0));
    float rad = 0.30 + 0.07*fk;
    float w = exp(-(a*a)/(rad*rad));
    q = rotAxis(c, uP0.w*w*(5.5 + fk))*q;
    storm = max(storm, w);
    eye = max(eye, exp(-(a*a)/(rad*rad*0.012)));
  }
  vec3 f = q*2.4 + vec3(uP0.x*0.17, 0.0, uP0.x*0.29) + vec3(uTime*2.0e-5, 0.0, 0.0);
  float base = fbmL(f, 6, lod*2.4);
  float arms = fbmL(vec3(f.x*0.7, f.y*0.7, f.z*0.7) + 4.0, 3, lod*1.7);
  float tz = 1.0 - smoothstep(0.0, 0.5, abs(dot(p, sunB)));
  float cover = uP0.z + 0.10*storm + 0.08*tz - 0.40*eye;
  return smoothstep(1.0 - cover - 0.10, 1.0 - cover + 0.13, base + 0.06*storm + 0.10*(arms - 0.5));
}
float cloudCover(vec3 p, vec3 sunB, float lod){ return cDens(p, sunB, lod); }
vec4 cloudsAt(vec3 p, vec3 sunB, float lod){
  float d0 = cDens(p, sunB, lod);
  float shade = 1.0 - 0.20*d0;
  if (uQuality > 0.5){
    vec3 tl = sunB - p*dot(p, sunB);
    float l = length(tl);
    vec3 ps = normalize(p + (l > 1e-3 ? tl/l : vec3(0.0))*0.016);
    float d1 = cDens(ps, sunB, lod*1.5);
    shade = clamp(1.0 - (d1 - d0)*1.5 - 0.20*d0, 0.34, 1.0);
  }
  vec3 col = mix(vec3(0.58, 0.63, 0.72), vec3(1.0, 0.99, 0.97), shade);
  return vec4(col*0.95, pow(d0, 0.9)*0.97);
}
`,
};
