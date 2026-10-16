// ORPHEUS · surface · baked-height GPU clipmap terrain.
// 11 nested N×N lattices (cell 0.5 m … 512 m) that follow the camera, snapped to 2 cells so every level stays world-aligned.
// Heights are BAKED on the GPU into a float texture array (one 133² layer per level; R = height at the level's own LOD, G = height at
// the next-coarser LOD) by evaluating the biome's analytic function once per texel (tiny shader → fast to compile); the terrain vertex
// shader only does texelFetch. Re-bake a level when its snapped centre moves. Flora/water/etc. sample the same textures (GLSL_BAKED).
// Seams: vertices near a ring's outer edge geomorph R→G and to the coarse neighbours' average; the coarse ring discards fragments
// inside the finer ring's exact square; thin skirts hide residual sub-pixel cracks.
import * as THREE from 'three';
import { glslHeightModule, GLSL_RIVER_FN } from './biomes.js';
import { GLSL_NOISE } from './noise.js';
import { GLSL_SHADE_COMMON, GLSL_SURFACE } from './shading.js';
import { GLSL_ATMO } from './atmosphere.js';

export const CLIP = { N: 128, HOLE: 31, LEVELS: 11, C0: 0.5, TEX: 133, OFF: 66 };

/** GLSL: sample baked terrain height (height rel. pad, no curvature) at world xz, picking the finest level that contains it. */
export const GLSL_BAKED = /* glsl */ `
uniform highp sampler2DArray uHT; uniform vec2 uHC[11];
float sfBakedH(vec2 p){
  for (int k = 0; k < 11; k++){
    float c = 0.5 * exp2(float(k));
    vec2 d = (p - uHC[k]) / c;
    if (max(abs(d.x), abs(d.y)) < 61.0){
      vec2 tc = d + 66.0; vec2 fl = floor(tc); vec2 f = tc - fl; ivec2 i0 = ivec2(fl);
      float a = texelFetch(uHT, ivec3(i0, k), 0).r, b = texelFetch(uHT, ivec3(i0 + ivec2(1,0), k), 0).r;
      float c2 = texelFetch(uHT, ivec3(i0 + ivec2(0,1), k), 0).r, d2 = texelFetch(uHT, ivec3(i0 + ivec2(1,1), k), 0).r;
      return mix(mix(a, b, f.x), mix(c2, d2, f.x), f.y);
    }
  }
  return -1e4;
}
`;

function buildGeometries() {
  const { N, HOLE } = CLIP, W = N + 1, nGrid = W * W, nSk = 4 * N;
  const pos = new Float32Array((nGrid + nSk) * 3), sk = new Float32Array(nGrid + nSk);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const v = j * W + i; pos[v * 3] = i - N / 2; pos[v * 3 + 2] = j - N / 2; }
  const bnd = [];
  for (let i = 0; i < N; i++) bnd.push(0 * W + i);
  for (let j = 0; j < N; j++) bnd.push(j * W + N);
  for (let i = N; i > 0; i--) bnd.push(N * W + i);
  for (let j = N; j > 0; j--) bnd.push(j * W + 0);
  for (let k = 0; k < nSk; k++) { const v = nGrid + k, s = bnd[k]; pos[v * 3] = pos[s * 3]; pos[v * 3 + 1] = 0; pos[v * 3 + 2] = pos[s * 3 + 2]; sk[v] = 1; }
  const skirtIdx = [];
  for (let k = 0; k < nSk; k++) { const a = bnd[k], b = bnd[(k + 1) % nSk], ab = nGrid + k, bb = nGrid + ((k + 1) % nSk); skirtIdx.push(a, b, ab, b, bb, ab); }
  const build = (hole) => {
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = i - N / 2, b = j - N / 2;
      if (hole && a >= -HOLE && a < HOLE && b >= -HOLE && b < HOLE) continue;
      const v00 = j * W + i, v10 = v00 + 1, v01 = v00 + W, v11 = v01 + 1;
      idx.push(v00, v01, v11, v00, v11, v10);
    }
    for (const s of skirtIdx) idx.push(s);
    return new Uint16Array(idx);
  };
  const posA = new THREE.BufferAttribute(pos, 3), skA = new THREE.BufferAttribute(sk, 1);
  const mk = (index) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', posA); g.setAttribute('aSkirt', skA); g.setIndex(new THREE.BufferAttribute(index, 1)); return g; };
  return { full: mk(build(false)), ring: mk(build(true)) };
}

const VS_DECL = /* glsl */ `
attribute float aSkirt;
uniform highp sampler2DArray uHT;
uniform float uCell; uniform float uSkirt; uniform float uHalf; uniform float uK; uniform float uGroundY; uniform int uLevel;
uniform vec2 uCenter; uniform vec2 uCurvC;
varying vec3 vSfLocal; varying vec3 vSfN; varying float vSfH;
float sfCurv(vec2 p){ vec2 d = p - uCurvC; return uK * dot(d, d); }
vec4 sfT(ivec2 ti){ return texelFetch(uHT, ivec3(ti, uLevel), 0); }
`;
const VS_BEGIN = /* glsl */ `
vec2 sfIdx = position.xz;
ivec2 sfTi = ivec2(sfIdx) + ivec2(66);
vec2 sfP = uCenter + sfIdx * uCell;
float sfEdge = max(abs(sfIdx.x), abs(sfIdx.y)) / (uHalf / uCell);
float sfT0 = smoothstep(0.72, 0.97, sfEdge);
float sfCv = sfCurv(sfP);
vec2 sfHv = sfT(sfTi).rg;
float sfYf = sfHv.x - sfCv, sfYg = sfHv.y - sfCv;
float sfY0 = mix(sfYf, sfYg, sfT0);
float sfYm = sfY0;
vec2 sfOdd = mod(sfIdx, 2.0);
if (sfT0 > 0.0 && (sfOdd.x + sfOdd.y) > 0.5) {
  ivec2 oa, ob;
  if (sfOdd.y < 0.5) { oa = ivec2(-1, 0); ob = ivec2(1, 0); }
  else if (sfOdd.x < 0.5) { oa = ivec2(0, -1); ob = ivec2(0, 1); }
  else { oa = ivec2(-1, -1); ob = ivec2(1, 1); }
  float ga = sfT(sfTi + oa).g - sfCurv(sfP + vec2(oa) * uCell);
  float gb = sfT(sfTi + ob).g - sfCurv(sfP + vec2(ob) * uCell);
  sfYm = mix(sfY0, 0.5 * (ga + gb), sfT0);
}
float sfFx = sfT(sfTi + ivec2(1, 0)).r - sfCurv(sfP + vec2(uCell, 0.0)), sfFz = sfT(sfTi + ivec2(0, 1)).r - sfCurv(sfP + vec2(0.0, uCell));
float sfGx = sfT(sfTi + ivec2(2, 0)).g - sfCurv(sfP + vec2(2.0 * uCell, 0.0)), sfGz = sfT(sfTi + ivec2(0, 2)).g - sfCurv(sfP + vec2(0.0, 2.0 * uCell));
vec3 sfNf = normalize(vec3(sfYf - sfFx, uCell, sfYf - sfFz)), sfNg = normalize(vec3(sfYg - sfGx, 2.0 * uCell, sfYg - sfGz));
vec3 sfN = normalize(mix(sfNf, sfNg, sfT0));
vec3 sfPos = vec3(sfP.x, uGroundY + sfYm - aSkirt * uSkirt, sfP.y);
vSfLocal = sfPos; vSfN = sfN; vSfH = sfYm + sfCv;
vec3 objectNormal = sfN;
`;
const FS_DECL = (biome) => /* glsl */ `
${GLSL_NOISE}
uniform vec4 uP[8]; uniform vec4 uV[8]; uniform int uVN; uniform uint uSeed;
uniform vec2 uInnerC; uniform float uInnerH; uniform vec4 uPadA[8]; uniform int uPadN;
${biome === 'phlegethon' ? GLSL_RIVER_FN : ''}
${GLSL_ATMO}
${GLSL_SHADE_COMMON}
${GLSL_SURFACE[biome]}
varying vec3 vSfLocal; varying vec3 vSfN; varying float vSfH;
vec3 sfPadTint(vec3 alb, vec2 xz){
  vec2 q = xz - uPadA[0].xy; float d = length(q), r0 = uPadA[0].z;
  float streak = sfVN2(vec2(atan(q.y, q.x) * 7.0, d * 0.05), uSeed + 411u);
  float sc = 1.0 - smoothstep(r0 * 0.35, r0 * 1.05, d + (streak - 0.5) * r0 * 0.35);
  vec3 burnt = vec3(dot(alb, vec3(0.3, 0.5, 0.2))) * vec3(0.58, 0.55, 0.52) * 0.72;
  return mix(alb, burnt, sc * 0.75);
}
`;

const BAKE_VERT = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const bakeFrag = (biome) => /* glsl */ `
precision highp float; precision highp int;
${glslHeightModule(biome)}
uniform vec2 uBCenter; uniform float uBCell; uniform int uBN;
void main(){
  vec2 ij = floor(gl_FragCoord.xy) - 66.0;
  vec2 p = uBCenter + ij * uBCell;
  vec2 hv = vec2(0.0);
  for (int i = 0; i < uBN; i++){ float cell = uBCell * float(1 + i); hv[i] = sfHeight(p, cell); }
  gl_FragColor = vec4(hv, 0.0, 1.0);
}`;

/**
 * @param o { renderer, hf: Heightfield, atmo: Atmosphere, biome, groundY0, seaY (height rel. pad of the sea surface, or −1e5) }
 * @returns { group, update(camPos, t), bakeAll(camPos), levels, shared, compile(), dispose() }
 */
export function createTerrain(o) {
  const { renderer, hf, atmo, biome, groundY0 } = o, { N, LEVELS, C0, TEX } = CLIP;
  const geos = buildGeometries();
  const hu = hf.uniformValues();
  const v4 = (arr) => { const r = []; for (let i = 0; i < 8; i++) r.push(new THREE.Vector4(arr[i * 4], arr[i * 4 + 1], arr[i * 4 + 2], arr[i * 4 + 3])); return r; };

  // baked height clipmap
  const rt = new THREE.WebGLArrayRenderTarget(TEX, TEX, LEVELS, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
  rt.texture.generateMipmaps = false;
  const centers = []; for (let k = 0; k < LEVELS; k++) centers.push(new THREE.Vector2(1e9, 1e9));
  const shared = {
    uP: { value: v4(hu.P) }, uV: { value: v4(hu.V) }, uVN: { value: hu.vn },
    uPadA: { value: hu.padA.map((a) => new THREE.Vector4(a[0], a[1], a[2], a[3])) }, uPadY: { value: hu.padY }, uPadN: { value: hu.padN },
    uH0: { value: hu.h0 }, uSeed: { value: hu.seed }, uK: { value: hf.curvK }, uGroundY: { value: groundY0 }, uCurvC: { value: new THREE.Vector2(hf.curvC[0], hf.curvC[1]) },
    uTime: { value: 0 }, uSeaY: { value: o.seaY ?? -1e5 }, uHT: { value: rt.texture }, uHC: { value: centers },
    ...atmo.uniforms,
  };

  // bake pass
  const bakeMat = new THREE.ShaderMaterial({
    vertexShader: BAKE_VERT, fragmentShader: bakeFrag(biome), depthTest: false, depthWrite: false,
    uniforms: { uP: shared.uP, uV: shared.uV, uVN: shared.uVN, uPadA: shared.uPadA, uPadY: shared.uPadY, uPadN: shared.uPadN, uH0: shared.uH0, uSeed: shared.uSeed, uBCenter: { value: new THREE.Vector2() }, uBCell: { value: 1 }, uBN: { value: 2 } },
  });
  const bakeGeo = new THREE.BufferGeometry(); bakeGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const bakeMesh = new THREE.Mesh(bakeGeo, bakeMat); bakeMesh.frustumCulled = false;
  const bakeScene = new THREE.Scene(); bakeScene.add(bakeMesh);
  const bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const group = new THREE.Group(); group.name = 'terrain';
  const levels = [];
  const key = `sfTerrain2-${biome}`;
  for (let k = 0; k < LEVELS; k++) {
    const cell = C0 * Math.pow(2, k), half = N / 2 * cell;
    const lu = {
      uCell: { value: cell }, uHalf: { value: half }, uSkirt: { value: cell * 1.6 + 0.35 }, uLevel: { value: k },
      uCenter: { value: new THREE.Vector2() }, uInnerC: { value: new THREE.Vector2() }, uInnerH: { value: -1 },
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared, lu);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + VS_DECL)
        .replace('#include <beginnormal_vertex>', VS_BEGIN)
        .replace('#include <begin_vertex>', 'vec3 transformed = sfPos;');
      let fs = shader.fragmentShader;
      fs = fs.replace('#include <common>', '#include <common>\n' + FS_DECL(biome));
      fs = fs.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (uInnerH > 0.0 && abs(vSfLocal.x - uInnerC.x) < uInnerH && abs(vSfLocal.z - uInnerC.y) < uInnerH) discard;');
      fs = fs.replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        vec3 sfAlb; float sfRough; vec3 sfEmis; vec3 sfBump; float sfRefl;
        sfPx = length(vViewPosition) * 0.0050;
        sfSurface(vSfLocal, normalize(vSfN), vSfH, length(vViewPosition), sfAlb, sfRough, sfEmis, sfBump, sfRefl);
        diffuseColor.rgb = sfPadTint(sfAlb, vSfLocal.xz);`);
      fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = sfRough;');
      fs = fs.replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
        { vec3 gv = (viewMatrix * vec4(sfBump, 0.0)).xyz; gv -= normal * dot(gv, normal); normal = normalize(normal - gv); }`);
      fs = fs.replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
        { vec3 vv = normalize(vViewPosition); float nv = clamp(dot(normal, vv), 0.0, 1.0); float F = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
          vec3 rW = normalize((vec4(reflect(-vv, normal), 0.0) * viewMatrix).xyz);
          totalEmissiveRadiance += sfEmis + sfRefl * F * (1.0 - sfRough) * sfSkyRefl(rW); }`);
      fs = fs.replace('#include <fog_fragment>', /* glsl */ `
        { float sfD = length(vViewPosition); vec3 sfV = normalize((vec4(-vViewPosition, 0.0) * viewMatrix).xyz); gl_FragColor.rgb = sfFog(gl_FragColor.rgb, sfV, sfD); }`);
      shader.fragmentShader = fs;
    };
    mat.customProgramCacheKey = () => key;
    mat.fog = false;
    const mesh = new THREE.Mesh(k === 0 ? geos.full : geos.ring, mat);
    mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false; mesh.renderOrder = k; mesh.name = `terrain-L${k}`;
    group.add(mesh);
    levels.push({ cell, half, lu, mesh, mat, cx: NaN, cz: NaN });
  }

  function bakeLevel(k, cx, cz) {
    const L = levels[k];
    bakeMat.uniforms.uBCenter.value.set(cx, cz); bakeMat.uniforms.uBCell.value = L.cell;
    const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(rt, k);
    renderer.render(bakeScene, bakeCam);
    renderer.setRenderTarget(prevRT); renderer.autoClear = prevAuto;
    centers[k].set(cx, cz);
    L.cx = cx; L.cz = cz;
  }

  const cen = new Array(LEVELS);
  function layout(camPos, maxBakes) {
    let baked = 0;
    for (let k = 0; k < LEVELS; k++) {
      const L = levels[k], s = 2 * L.cell;
      const cx = Math.round(camPos.x / s) * s, cz = Math.round(camPos.z / s) * s;
      if ((cx !== L.cx || cz !== L.cz) && baked < maxBakes) { bakeLevel(k, cx, cz); baked++; }
      // a level whose bake is deferred keeps its previous (baked) centre so geometry and texture stay consistent
      cen[k] = [L.cx, L.cz];
      L.lu.uCenter.value.set(L.cx, L.cz);
      if (k > 0) { L.lu.uInnerC.value.set(cen[k - 1][0], cen[k - 1][1]); L.lu.uInnerH.value = levels[k - 1].half; }
    }
  }

  return {
    group, levels, shared, rt,
    /** bake every level for this camera position (call once before the first frame) */
    bakeAll(camPos) { layout(camPos, LEVELS); },
    update(camPos, t) { shared.uTime.value = t; layout(camPos, 3); },
    setSea(seaY) { shared.uSeaY.value = seaY; },
    /** compile the bake program (+ terrain programs happen with the scene compile) */
    compileBake() { return renderer.compileAsync ? renderer.compileAsync(bakeScene, bakeCam) : Promise.resolve(renderer.compile(bakeScene, bakeCam)); },
    dispose() { geos.full.dispose(); geos.ring.dispose(); for (const L of levels) L.mat.dispose(); bakeMat.dispose(); bakeGeo.dispose(); rt.dispose(); },
  };
}
