// Generic rocky world — fallback until a body has its own module. uP0 = (seed, hue shift, contrast, 0), uP1.xyz = base colour.
export default {
  id: 'generic',
  defines: {},
  params: (look) => ({ uP0: [look.seed ?? 1.0, 0, 1, 0], uP1: [...(look.color ?? [0.4, 0.4, 0.4]), 0] }),
  glsl: /* glsl */ `
Surf surfaceAt(vec3 p, vec3 sunB, float lod){
  Surf s = surfDefault(p);
  float n = fbmL(p*3.0 + uP0.x, 7, lod*3.0);
  float m = fbmL(p*11.0 + uP0.x*2.0, 5, lod*11.0);
  s.albedo = uP1.xyz*(0.45 + 1.1*n)*(0.8 + 0.4*m);
  s.rough = 0.9;
  return s;
}
`,
};
