// Lethe — ringed gas giant: pale blue-violet bands, shear filaments, swirling storm ovals, and a Cassini-like ring system
// (B ring, Cassini division, A ring with Encke/Keeler gaps, F ring) with forward-scatter glow and mutual shadows.
// uP0 = (seed, band contrast, storm strength, flow speed)
export default {
  id: 'lethe',
  defines: { HAS_RINGS: 1 },
  params: (look) => ({ uP0: [look.seed ?? 1.9, 1.0, 1.0, 1.0, 0] }),
  glsl: /* glsl */ `
float bandProfile(float lat, float turb){
  float a = lat + turb*0.14;
  float b = 0.5 + 0.5*sin(a*11.0 + 0.7);
  b = 0.58*b + 0.42*(0.5 + 0.5*sin(a*27.0 + 2.1*sin(a*5.0)));
  b = mix(b, 0.5 + 0.5*sin(a*63.0 + turb*7.0), 0.16);
  return clamp(b, 0.0, 1.0);
}

Surf surfaceAt(vec3 p, vec3 sunB, float lod){
  Surf s = surfDefault(p);
  s.rough = 1.0; s.spec = 0.0;
  // slow differential rotation: equatorial jet moves faster
  float lat0 = asin(clamp(p.z, -1.0, 1.0));
  float spin = uTime*uP0.w*1.1e-5*(1.0 + 0.6*cos(lat0*2.0));
  vec3 q = rotAxis(vec3(0.0, 0.0, 1.0), spin)*p;
  // storm ovals: swirl the lookup coordinates, remember their interiors
  float spot = 0.0, rim = 0.0;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float la = (i == 0 ? -0.38 : (i == 1 ? 0.56 : -0.95));
    float lo = (i == 0 ? 0.7 : (i == 1 ? -1.6 : 2.4)) + uP0.x*0.3;
    float rad = (i == 0 ? 0.21 : (i == 1 ? 0.11 : 0.075));
    vec3 c = vec3(cos(la)*cos(lo), cos(la)*sin(lo), sin(la));
    vec3 e = normalize(cross(vec3(0.0, 0.0, 1.0), c)), n = cross(c, e);
    vec3 d = q - c*dot(q, c);
    float a = length(vec2(dot(d, e)/1.7, dot(d, n)));
    float w = exp(-(a*a)/(rad*rad*2.2));
    q = rotAxis(c, uP0.z*w*(4.2 + 1.3*fi)*(i == 1 ? -1.0 : 1.0))*q;
    spot = max(spot, smoothstep(rad*1.05, rad*0.5, a));
    rim = max(rim, smoothstep(rad*1.55, rad*1.0, a)*smoothstep(rad*0.55, rad*1.0, a));
  }
  vec3 qa = vec3(q.x*1.35, q.y*1.35, q.z*5.2);
  float tb = fbmL(qa*1.9 + vec3(uP0.x, uP0.x*0.4, 0.0), 6, lod*5.2*1.9);
  float tb2 = fbmL(qa*4.6 + 9.0, 5, lod*5.2*4.6);
  float lat = asin(clamp(q.z, -1.0, 1.0));
  float b = bandProfile(lat, (tb - 0.5)*1.25);
  b = clamp((b - 0.5)*uP0.y + 0.5, 0.0, 1.0);

  vec3 zone = vec3(0.76, 0.76, 0.97), belt = vec3(0.27, 0.29, 0.66), teal = vec3(0.40, 0.62, 0.82), dark = vec3(0.12, 0.13, 0.36), cream = vec3(0.94, 0.91, 0.98);
  vec3 col = mix(belt, zone, smoothstep(0.22, 0.78, b));
  col = mix(col, teal, smoothstep(0.58, 0.92, tb)*0.4*(1.0 - b));
  col = mix(col, dark, smoothstep(0.34, 0.04, b)*0.4*smoothstep(0.25, 0.95, tb2));
  float streak = fbmL(vec3(q.x*2.2, q.y*2.2, q.z*46.0) + 4.0, 5, lod*46.0);
  col *= 0.80 + 0.42*streak;
  col *= 0.9 + 0.2*tb2;
  float pol = smoothstep(0.52, 0.95, abs(q.z));
  col = mix(col, vec3(0.18, 0.23, 0.50), pol*0.62);
  col = mix(col, cream, spot*0.72);
  col = mix(col, vec3(0.55, 0.36, 0.66), rim*0.45*(1.0 - spot));
  s.albedo = col*0.92;
  return s;
}

float gapM(float x, float c, float w, float pw){ return smoothstep(w - pw, w + pw, abs(x - c)); }
float ringBlock(float x, float a, float b, float pw){ return smoothstep(a - pw, a + pw, x)*(1.0 - smoothstep(b - pw, b + pw, x)); }

vec4 ringAt(float r, float pixW){
  float L = uRingR.y - uRingR.x;
  float x = (r - uRingR.x)/L;
  if (x < 0.0 || x > 1.0) return vec4(0.0);
  float pw = max(pixW/L, 1.0e-4);
  // ringlet structure, octaves fade out below the pixel size
  float n1 = sn(vec3(x*38.0, 1.3, uP0.x));
  float n2 = sn(vec3(x*150.0, 5.1, 0.3))*(1.0 - smoothstep(0.35, 0.9, pw*150.0*1.5));
  float n3 = sn(vec3(x*560.0, 9.4, 4.2))*(1.0 - smoothstep(0.35, 0.9, pw*560.0*1.5));
  float fine = clamp(0.62 + 0.20*n2 + 0.16*n3, 0.1, 1.2);

  float tau = 0.0; vec3 col = vec3(0.0);
  float dR = ringBlock(x, 0.015, 0.20, pw);
  float bR = ringBlock(x, 0.205, 0.595, pw);
  float cR = ringBlock(x, 0.60, 0.675, pw);
  float aR = ringBlock(x, 0.68, 0.930, pw);
  float tD = dR*(0.05 + 0.20*smoothstep(0.0, 0.2, x))*(0.7 + 0.5*n1);
  float tB = bR*(1.45 + 0.75*n1 + 0.35*sin(x*61.0))*fine*1.25;
  float tC = cR*(0.05 + 0.04*n2) + 0.30*exp(-pow((x - 0.642)/0.006, 2.0));
  float tA = aR*(0.58 + 0.20*n1)*fine*gapM(x, 0.856, 0.009, pw)*gapM(x, 0.912, 0.0045, pw);
  float tF = 0.30*exp(-pow((x - 0.962)/0.0045, 2.0)) + 0.028*ringBlock(x, 0.935, 0.99, pw);
  tau = max(tD + tB + tC + tA + tF, 0.0);
  col = (vec3(0.46, 0.43, 0.56)*tD + vec3(0.90, 0.84, 0.95)*tB + vec3(0.56, 0.54, 0.70)*tC + vec3(0.72, 0.75, 0.92)*tA + vec3(0.66, 0.62, 0.78)*tF)/max(tD + tB + tC + tA + tF, 1.0e-4);
  col *= 0.88 + 0.22*n2;
  return vec4(col, tau);
}
`,
};
