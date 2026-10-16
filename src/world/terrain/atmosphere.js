// ORPHEUS · surface · atmosphere.
// One analytic single-scatter sky (GLSL `sfSky`, JS twin `skyRadiance`) used by:
//   · the sky dome — TWO passes composited over the ray-traced background: (1) dst ·= T(rgb)   (2) dst += inscatter
//     (equivalent to result = inscatter + background × transmittance, but with per-channel transmittance)
//   · terrain / prop distance fog (aerial perspective toward the same horizon colour → seamless horizon)
//   · hemisphere/sun light colours (extinction through the atmosphere, twilight)
// Absolute radiance units (see DESIGN §3.1): exposure is NOT applied here.
import * as THREE from 'three';

export const ATMO_PRESETS = {
  asphodel:   { beta: [0.050, 0.108, 0.250], mie: 0.030, mieG: 0.80, mieCol: [1.0, 0.92, 0.80], gain: 3.4, fogExt: [1 / 22000, 1 / 15500, 1 / 10500], ground: [0.30, 0.33, 0.30], amb: 0.012, mistAbove: 0 },
  phlegethon: { beta: [0.110, 0.170, 0.320], mie: 0.60, mieG: 0.62, mieCol: [1.0, 0.64, 0.30], gain: 2.5, fogExt: [1 / 2900, 1 / 2300, 1 / 1700], ground: [0.10, 0.07, 0.05], amb: 0.02, mistAbove: 0 },
  cocytus:    { beta: [0.075, 0.135, 0.290], mie: 0.32, mieG: 0.70, mieCol: [0.78, 0.88, 1.0], gain: 3.8, fogExt: [1 / 4600, 1 / 3700, 1 / 2800], ground: [0.55, 0.62, 0.72], amb: 0.03, mistAbove: 0 },
  elysium:    { beta: [0.020, 0.050, 0.120], mie: 0.05, mieG: 0.50, mieCol: [0.62, 0.72, 1.0], gain: 1.7, fogExt: [1 / 9500, 1 / 7000, 1 / 5200], ground: [0.05, 0.07, 0.14], amb: 0.02, mistAbove: 0 },
};

// ───────────────────────────── GLSL ─────────────────────────────
export const GLSL_ATMO = /* glsl */ `
uniform vec3 uAtSun; uniform vec3 uAtSunCol; uniform vec3 uAtSunColHi; uniform vec3 uAtBeta; uniform float uAtMie; uniform float uAtG;
uniform vec3 uAtMieCol; uniform float uAtGain; uniform vec3 uAtFogExt; uniform vec3 uAtGround; uniform float uAtAmb; uniform float uAtOn; uniform float uAtTwi;
vec3 sfSkyT(vec3 v){                                    // transmittance to space along v (per channel)
  float mu = max(v.y, 0.0);
  float am = min(1.0 / (mu + 0.035), 28.0);
  return exp(-(uAtBeta + vec3(uAtMie)) * am) * uAtOn + vec3(1.0 - uAtOn);
}
vec3 sfSky(vec3 v){                                     // inscatter radiance toward v
  float mu = max(v.y, 0.0);
  float am = min(1.0 / (mu + 0.12), 5.5);
  vec3 bE = max(uAtBeta + vec3(uAtMie), vec3(1e-4));
  float cs = dot(v, uAtSun);
  float phR = 0.0596831 * (1.0 + cs * cs);
  float g = uAtG, den = 1.0 + g * g - 2.0 * g * cs;
  float phM = 0.0795775 * (1.0 - g * g) / (den * sqrt(den));
  vec3 sc = (uAtBeta * phR + uAtMieCol * uAtMie * phM) / bE;
  vec3 sunS = mix(uAtSunCol, uAtSunColHi, smoothstep(0.0, 0.55, v.y));   // sunlight reaching the scatterers: reddened near the horizon, bluer overhead
  vec3 col = sunS * sc * (1.0 - exp(-bE * am)) * uAtGain;
  // twilight glow on the sun side of the horizon + ambient floor
  vec2 hv = normalize(v.xz + vec2(1e-4)), hs = normalize(uAtSun.xz + vec2(1e-4));
  float side = 0.35 + 0.65 * max(dot(hv, hs), 0.0);
  col += uAtTwi * side * exp(-mu * 5.5) * vec3(1.0, 0.45, 0.22) * 0.30;
  col += uAtAmb * (uAtBeta / bE) * (0.35 + 0.65 * exp(-mu * 3.0)) * 8.0;
  return col * uAtOn;
}
vec3 sfSkyRefl(vec3 r){                                 // sky as seen in a mirror (ground colour below the horizon)
  vec3 sky = sfSky(vec3(r.x, max(r.y, 0.0), r.z));
  vec3 gnd = uAtGround * (uAtSunCol * max(uAtSun.y, 0.0) * 0.12 + sky * 0.30 + vec3(0.01));
  return mix(gnd, sky, smoothstep(-0.10, 0.05, r.y));
}
vec3 sfFog(vec3 col, vec3 vdir, float d){               // aerial perspective toward the horizon sky
  if (uAtOn < 0.5) return col;
  vec3 T = exp(-uAtFogExt * d);
  vec3 insc = sfSky(normalize(vec3(vdir.x, max(vdir.y, 0.0), vdir.z)));
  return mix(insc, col, mix(vec3(1.0), T, uAtOn));
}
`;

const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}`;
const DOME_FRAG_T = /* glsl */ `
precision highp float;
${GLSL_ATMO}
varying vec3 vDir;
void main(){ gl_FragColor = vec4(sfSkyT(normalize(vDir)), 1.0); }`;
const DOME_FRAG_S = /* glsl */ `
precision highp float;
${GLSL_ATMO}
varying vec3 vDir;
void main(){ gl_FragColor = vec4(sfSky(normalize(vDir)), 1.0); }`;

// ───────────────────────────── JS twin of sfSky (for ambient light colours) ─────────────────────────────
function skyRadianceJS(U, v, out) {
  const mu = Math.max(v[1], 0), am = Math.min(1 / (mu + 0.12), 5.5);
  const cs = v[0] * U.sun[0] + v[1] * U.sun[1] + v[2] * U.sun[2];
  const phR = 0.0596831 * (1 + cs * cs), g = U.g, den = 1 + g * g - 2 * g * cs, phM = 0.0795775 * (1 - g * g) / (den * Math.sqrt(den));
  const hl = Math.hypot(v[0], v[2]) + 1e-4, sl = Math.hypot(U.sun[0], U.sun[2]) + 1e-4;
  const side = 0.35 + 0.65 * Math.max((v[0] / hl) * (U.sun[0] / sl) + (v[2] / hl) * (U.sun[2] / sl), 0);
  for (let c = 0; c < 3; c++) {
    const bE = Math.max(U.beta[c] + U.mie, 1e-4), sc = (U.beta[c] * phR + U.mieCol[c] * U.mie * phM) / bE;
    const sunS = U.sunCol[c] + (U.sunColHi[c] - U.sunCol[c]) * smooth(0.0, 0.55, v[1]);
    let col = sunS * sc * (1 - Math.exp(-bE * am)) * U.gain;
    col += U.twi * side * Math.exp(-mu * 5.5) * [1.0, 0.45, 0.22][c] * 0.30;
    col += U.amb * (U.beta[c] / bE) * (0.35 + 0.65 * Math.exp(-mu * 3.0)) * 8.0;
    out[c] = col * U.on;
  }
  return out;
}

const _t = [0, 0, 0];

export class Atmosphere {
  /**
   * @param biome   'asphodel' | 'phlegethon' | 'charon' | 'cocytus' | 'elysium'
   * @param body    catalog-like body ({atmosphere: null | {density, ...}})
   * @param look    LOOKS[biome] (sunCol, sunI, hemi...)
   */
  constructor(biome, body, look) {
    this.biome = biome; this.look = look;
    const pre = ATMO_PRESETS[biome];
    this.airless = !pre || !body.atmosphere;
    const p = pre || ATMO_PRESETS.asphodel;
    const dens = this.airless ? 0 : (body.atmosphere.density ?? 1) * (biome === 'elysium' ? 1 : 1);
    const k = this.airless ? 0 : clampNum(dens, 0.2, 2.0);
    this.P = { beta: p.beta.map((b) => b * (biome === 'elysium' ? 1 : k)), mie: p.mie * (biome === 'elysium' ? 1 : k), g: p.mieG, mieCol: p.mieCol, gain: p.gain, amb: p.amb, ground: p.ground };
    this.U = { sun: [0, 1, 0], sunCol: [1, 1, 1], sunColHi: [1, 1, 1], beta: this.P.beta, mie: this.P.mie, g: p.mieG, mieCol: p.mieCol, gain: p.gain, amb: p.amb, twi: 0, on: this.airless ? 0 : 1 };
    const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    this.uniforms = {
      uAtSun: { value: new THREE.Vector3(0, 1, 0) }, uAtSunCol: { value: new THREE.Vector3(1, 1, 1) }, uAtSunColHi: { value: new THREE.Vector3(1, 1, 1) },
      uAtBeta: { value: v3(this.P.beta) }, uAtMie: { value: this.P.mie }, uAtG: { value: p.mieG }, uAtMieCol: { value: v3(p.mieCol) },
      uAtGain: { value: p.gain }, uAtFogExt: { value: v3(p.fogExt) }, uAtGround: { value: v3(p.ground) }, uAtAmb: { value: p.amb },
      uAtOn: { value: this.airless ? 0 : 1 }, uAtTwi: { value: 0 },
    };
    this.fogScale = this.airless ? 0 : k;
    if (!this.airless) this.uniforms.uAtFogExt.value.multiplyScalar(k);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    // outputs for the lights
    this.sunColor = new THREE.Color(1, 1, 1); this.sunIntensity = look.sunI;
    this.hemiSky = new THREE.Color(...look.hemiSky); this.hemiGround = new THREE.Color(...look.hemiGround); this.hemiIntensity = look.hemiI;
    this.domeMeshes = [];
    this.patched = new WeakSet();
  }

  /** set the light direction (unit, ship space) and recompute colours. `strength` scales the key light (0..1+). */
  setSun(dir, strength = 1) {
    const L = this.look, U = this.U, sd = this.sunDir.set(dir[0], dir[1], dir[2]).normalize();
    U.sun[0] = sd.x; U.sun[1] = sd.y; U.sun[2] = sd.z;
    const sy = sd.y;
    // sunlight extinction through the atmosphere (per channel)
    const amSun = Math.min(1 / (Math.max(sy, 0) + 0.035), 28);
    const sunVis = smooth(-0.10, 0.015, sy);
    const T = this.airless ? [1, 1, 1] : U.beta.map((b) => Math.exp(-(b + U.mie * 0.5) * amSun));
    const THi = this.airless ? [1, 1, 1] : U.beta.map((b) => Math.exp(-(b + U.mie * 0.5) * amSun * 0.28));
    for (let c = 0; c < 3; c++) { U.sunCol[c] = L.sunCol[c] * (L.sunI * strength * T[c]) * sunVis; U.sunColHi[c] = L.sunCol[c] * (L.sunI * strength * THi[c]) * sunVis; }
    this.uniforms.uAtSun.value.copy(sd); this.uniforms.uAtSunCol.value.set(U.sunCol[0], U.sunCol[1], U.sunCol[2]); this.uniforms.uAtSunColHi.value.set(U.sunColHi[0], U.sunColHi[1], U.sunColHi[2]);
    // twilight bump (sun within ±9° of the horizon)
    U.twi = this.airless ? 0 : Math.exp(-Math.pow((sy - 0.0) / 0.09, 2)) * 1.0 * strength; this.uniforms.uAtTwi.value = U.twi;
    // key light colour/intensity: direction light carries (colour × intensity); intensity folded into colour
    this.sunColor.setRGB(U.sunCol[0] / Math.max(L.sunI * strength, 1e-4), U.sunCol[1] / Math.max(L.sunI * strength, 1e-4), U.sunCol[2] / Math.max(L.sunI * strength, 1e-4));
    this.sunIntensity = L.sunI * strength * sunVis * (this.airless ? 1 : Math.max(0.0, 0.25 + 0.75 * smooth(-0.02, 0.18, sy)));
    // hemisphere fill = mean sky radiance (π × radiance = irradiance on an upward plane)
    if (this.airless) { this.hemiSky.setRGB(...L.hemiSky); this.hemiGround.setRGB(...L.hemiGround); this.hemiIntensity = L.hemiI; return; }
    const acc = [0, 0, 0], o = [0, 0, 0]; let wsum = 0;
    const dirs = [[0, 1, 0, 1.6]];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, e = 0.55; dirs.push([Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e), 1.0]); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5, e = 0.12; dirs.push([Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e), 0.5]); }
    for (const d of dirs) { skyRadianceJS(U, d, o); acc[0] += o[0] * d[3]; acc[1] += o[1] * d[3]; acc[2] += o[2] * d[3]; wsum += d[3]; }
    const skyAvg = [acc[0] / wsum, acc[1] / wsum, acc[2] / wsum];
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    // clamp to the biome's authored fill so odd light directions never go black/blown
    const hemiI = Math.PI;
    this.hemiSky.setRGB(skyAvg[0], skyAvg[1], skyAvg[2]);
    const floorSky = L.hemiSky.map((x) => x * L.hemiI * (L.hemiFloor ?? 0.10) / Math.PI);
    this.hemiSky.r = Math.max(this.hemiSky.r, floorSky[0]); this.hemiSky.g = Math.max(this.hemiSky.g, floorSky[1]); this.hemiSky.b = Math.max(this.hemiSky.b, floorSky[2]);
    const gAlb = this.P.ground, e = Math.max(sy, 0) * lum(U.sunCol) / Math.PI;
    this.hemiGround.setRGB(gAlb[0] * (e * 0.6 + skyAvg[0] * 0.3) + 0.004, gAlb[1] * (e * 0.6 + skyAvg[1] * 0.3) + 0.004, gAlb[2] * (e * 0.6 + skyAvg[2] * 0.3) + 0.004);
    this.hemiIntensity = hemiI;
  }

  /** JS sky radiance (linear rgb) toward unit v — handy for fill/debug */
  skyAt(v, out = [0, 0, 0]) { return skyRadianceJS(this.U, v, out); }

  /** two-pass sky dome (transmittance multiply, then inscatter add). Returns a Group; null for airless worlds. */
  createDome() {
    if (this.airless) return null;
    const g = new THREE.Group(); g.name = 'sky-dome';
    const geo = new THREE.SphereGeometry(1, 48, 32);
    const mk = (frag, blendSrc, blendDst, order, name) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: DOME_VERT, fragmentShader: frag, uniforms: this.uniforms,
        side: THREE.BackSide, depthTest: true, depthWrite: false, transparent: true, fog: false,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc, blendDst, blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      });
      m.toneMapped = false;
      const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.renderOrder = order; mesh.name = name; return mesh;
    };
    const a = mk(DOME_FRAG_T, THREE.ZeroFactor, THREE.SrcColorFactor, -1002, 'sky-T');
    const b = mk(DOME_FRAG_S, THREE.OneFactor, THREE.OneFactor, -1001, 'sky-S');
    g.add(a, b); this.domeMeshes = [a, b];
    return g;
  }

  /** apply the aerial-perspective fog (and nothing else) to a MeshStandard/Physical material; idempotent. */
  patchMaterial(mat) {
    if (this.patched.has(mat)) return mat;
    this.patched.add(mat);
    const prev = mat.onBeforeCompile, uniforms = this.uniforms, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
    mat.onBeforeCompile = (shader, renderer) => {
      if (prev) prev.call(mat, shader, renderer);
      for (const k of Object.keys(uniforms)) shader.uniforms[k] = uniforms[k];
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_ATMO);
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', /* glsl */ `
        { float sfD = length(vViewPosition); vec3 sfV = normalize((vec4(-vViewPosition, 0.0) * viewMatrix).xyz);
          gl_FragColor.rgb = sfFog(gl_FragColor.rgb, sfV, sfD); }`);
    };
    mat.customProgramCacheKey = () => key + '|sfFog';
    mat.fog = false; mat.needsUpdate = true;
    return mat;
  }
}

const clampNum = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clampNum((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
