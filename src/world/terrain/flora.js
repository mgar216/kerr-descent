// ORPHEUS · surface · flora.
//   createFlora(o) → { group, update(camPos, t, dt), collide(p, radius, height), colliders, bakeAll(cam), compile(), dispose() }
// Asphodel: GPU-driven swaying grass in four windows around the camera — real blade tufts at the feet, alpha-tested clump quads
// mid-field, big tussocks far-field, and pale asphodel flowers. Placement is BAKED per window into a small float texture (one pass
// whenever the camera crosses a cell) so the instance vertex shader only does 2 texelFetches.
// Other biomes: delegates to flora_scatter.js (`o.scatterFactory`).
import * as THREE from 'three';
import { GLSL_NOISE, mulberry } from './noise.js';
import { GLSL_BAKED } from './terrain.js';

const PLACE_VERT = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// the grass colour/mask rules mirror shading.js (asphodel) so tufts melt into the ground colour
const PLACE_FRAG = /* glsl */ `
precision highp float; precision highp int;
${GLSL_NOISE}
${GLSL_BAKED}
uniform vec2 uCamCell; uniform float uW; uniform float uCellS; uniform uint uSeed; uniform float uK; uniform float uGroundY; uniform vec2 uCurvC; uniform float uSeaY;
uniform vec4 uPadA[8]; uniform int uPadN; uniform float uHalfR; uniform vec2 uHRange; uniform float uDensity; uniform float uKind; uniform vec2 uInner;
void main(){
  vec2 px = floor(gl_FragCoord.xy);
  float isB = mod(px.x, 2.0);
  vec2 slot = vec2(floor(px.x * 0.5), px.y);
  vec2 cell = slot + uW * floor((uCamCell + uW * 0.5 - slot) / uW);
  ivec2 ic = ivec2(cell);
  uint sd = uSeed + 300u + uint(uKind) * 97u;
  float r0 = sfR(ic, sd + 1u), r1 = sfR(ic, sd + 2u), r2 = sfR(ic, sd + 3u), r3 = sfR(ic, sd + 4u), r4 = sfR(ic, sd + 5u);
  vec2 gP = (cell + vec2(r0, r1)) * uCellS;
  vec2 camP = (uCamCell + 0.5) * uCellS;
  float gD = length(gP - camP);
  float gH = sfBakedH(gP);
  float gHx = sfBakedH(gP + vec2(0.8, 0.0)), gHz = sfBakedH(gP + vec2(0.0, 0.8));
  float slope = 1.0 - normalize(vec3(gH - gHx, 0.8, gH - gHz)).y;
  float m1 = sfVN2(gP * 0.011, uSeed + 3u), m2 = sfVN2(gP * 0.065, uSeed + 5u), m3 = sfVN2(gP * 0.42, uSeed + 7u);
  float rockM = smoothstep(0.30, 0.52, slope);
  float e = gH - uSeaY;
  float beach = 1.0 - smoothstep(1.7, 3.3, e);
  float enc = smoothstep(0.30, 0.70, m2 + (e - 1.8) * 0.20);
  float sandM = beach * (1.0 - enc * 0.85) * (1.0 - rockM * 0.9);
  float mask = (1.0 - rockM) * (1.0 - sandM);
  if (e < 0.6) mask = 0.0;
  float padK = smoothstep(uPadA[0].z * 0.92, uPadA[0].z * 1.22, length(gP - uPadA[0].xy));
  for (int i = 1; i < 8; i++){ if (i >= uPadN) break; padK *= smoothstep(uPadA[i].z * 0.8, uPadA[i].z * 1.05, length(gP - uPadA[i].xy)); }
  float clump = smoothstep(0.15, 0.85, sfVN2(gP * 0.045, uSeed + 310u));
  float dens = uDensity * (0.35 + 0.65 * clump) * mask * padK;
  float keep = step(r2, dens);
  float fade = (1.0 - smoothstep(uHalfR * 0.62, uHalfR * 0.97, gD)) * smoothstep(uInner.x, uInner.y, gD);
  float gh = (uHRange.x + (uHRange.y - uHRange.x) * r3) * keep * fade * (0.78 + 0.44 * m3);
  vec3 gA = vec3(0.36, 0.40, 0.36), gB = vec3(0.57, 0.61, 0.56), gC = vec3(0.50, 0.465, 0.35);
  vec3 grass = mix(gA, gB, smoothstep(0.15, 0.95, m2 * 0.6 + m3 * 0.25 + m1 * 0.15));
  grass = mix(grass, gC, smoothstep(0.60, 0.86, m1) * 0.5);
  grass *= (0.86 + 0.20 * m3) * (0.9 + 0.2 * r4);
  float curv = uK * dot(gP - uCurvC, gP - uCurvC);
  if (isB < 0.5) gl_FragColor = vec4(gP.x, uGroundY + gH - curv, gP.y, gh);
  else {
    vec3 col = uKind > 0.5 ? mix(vec3(0.80, 0.84, 0.88), vec3(0.95, 0.93, 0.86), r4) : grass;
    gl_FragColor = vec4(col, r4 * 6.2831853);
  }
}`;

// ───────────── geometries ─────────────
const _norm = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };

/** a tuft of narrow curved blades (3 tris each); unit height ≈ 1 */
function bladeTuft(blades, seed, spread, hMin, hMax, wMin, wMax) {
  const rnd = mulberry(seed), pos = [], nrm = [], idx = []; let vi = 0;
  for (let b = 0; b < blades; b++) {
    const ang = rnd() * Math.PI * 2, rad = Math.sqrt(rnd()) * spread, ox = Math.cos(ang) * rad, oz = Math.sin(ang) * rad;
    const yaw = rnd() * Math.PI * 2, w = wMin + rnd() * (wMax - wMin), hg = hMin + rnd() * (hMax - hMin), lean = 0.12 + rnd() * 0.55, curl = 0.3 + rnd() * 0.55;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const loc = [[-w, 0, 0], [w, 0, 0], [-w * 0.72, hg * 0.5, lean * hg * 0.28], [w * 0.72, hg * 0.5, lean * hg * 0.28], [0, hg, lean * hg * (0.7 + curl)]];
    for (const [x, y, z] of loc) pos.push(ox + cy * x + sy * z, y, oz - sy * x + cy * z);
    const n = _norm(sy * 0.20, 1.0, cy * 0.20);
    for (let k = 0; k < 5; k++) nrm.push(n[0], n[1], n[2]);
    idx.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2, vi + 2, vi + 3, vi + 4); vi += 5;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g;
}

/** three crossed quads (unit height, unit width) carrying the alpha-tested clump texture */
function clumpCross() {
  const pos = [], nrm = [], uv = [], idx = []; let vi = 0;
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI, c = Math.cos(a), s = Math.sin(a);
    for (const [x, y] of [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1]]) { pos.push(c * x, y, -s * x); uv.push(x + 0.5, y); const n = _norm(0, 1.0, 0.12); nrm.push(n[0], n[1], n[2]); }
    idx.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2); vi += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

/** low rounded tussock (upper hemisphere, unit height/width) for far-field grass mounds */
function tussockBlob() {
  const g = new THREE.SphereGeometry(0.5, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  g.translate(0, 0, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 2.0);          // height 1.0 at the apex
  g.deleteAttribute('uv'); g.computeVertexNormals();
  const nn = g.attributes.normal;                                        // soft grass-mound lighting: bias normals strongly toward up
  for (let i = 0; i < nn.count; i++) { const x = nn.getX(i) * 0.35, y = nn.getY(i) * 0.35 + 0.65, z = nn.getZ(i) * 0.35, l = Math.hypot(x, y, z); nn.setXYZ(i, x / l, y / l, z / l); }
  return g;
}

/** asphodel flower: thin stalk + a star of six petals */
function flowerGeometry(seed) {
  const rnd = mulberry(seed), pos = [], nrm = [], idx = []; let vi = 0;
  const H = 1.0, w = 0.010;
  const v = [[-w, 0, 0], [w, 0, 0], [-w * 0.8, H * 0.5, 0.01], [w * 0.8, H * 0.5, 0.01], [-w * 0.6, H * 0.95, 0.03], [w * 0.6, H * 0.95, 0.03]];
  for (const p of v) { pos.push(p[0], p[1], p[2]); nrm.push(0, 0.95, 0.3); }
  idx.push(0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4); vi = 6;
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + rnd() * 0.3, ca = Math.cos(a), sa = Math.sin(a), r = 0.075 + rnd() * 0.03, up = 0.035 + rnd() * 0.05;
    const c = [0, H * 0.96, 0.03], tip = [ca * r, H * 0.96 + up, 0.03 + sa * r];
    const side = [-sa * 0.022, H * 0.955, 0.03 + ca * 0.022], side2 = [sa * 0.022, H * 0.955, 0.03 - ca * 0.022];
    for (const p of [c, side, side2, tip]) { pos.push(p[0], p[1], p[2]); nrm.push(0, 1, 0); }
    idx.push(vi, vi + 1, vi + 3, vi, vi + 3, vi + 2); vi += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g;
}

/** clump alpha texture: ~34 curved tapered blades fanning from the bottom centre (luminance carries blade shading) */
function clumpTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const rnd = mulberry(77);
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 38; i++) {
    const x0 = S * (0.18 + 0.64 * rnd()), top = S * (0.04 + 0.5 * rnd() * rnd() + 0.02), w = 4 + rnd() * 7;
    const lean = (rnd() - 0.5) * S * 0.55 * (0.4 + 0.6 * (1 - top / S));
    const x1 = x0 + lean, ym = S * 0.5 + (S - top) * 0.0;
    const lum = 0.55 + 0.45 * rnd();
    const gr = g.createLinearGradient(0, S, 0, top);
    gr.addColorStop(0, `rgb(${(lum * 95) | 0},${(lum * 100) | 0},${(lum * 92) | 0})`); gr.addColorStop(0.55, `rgb(${(lum * 190) | 0},${(lum * 195) | 0},${(lum * 185) | 0})`); gr.addColorStop(1, `rgb(${(lum * 250) | 0},${(lum * 250) | 0},${(lum * 242) | 0})`);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x0 - w, S);
    g.quadraticCurveTo(x0 - w * 0.5 + lean * 0.15, ym, x1, top);
    g.quadraticCurveTo(x0 + w * 0.5 + lean * 0.15, ym, x0 + w, S); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  return t;
}

// ───────────── shaders ─────────────
const GRASS_VS_DECL = /* glsl */ `
attribute vec2 aSlot;
uniform highp sampler2D uPlace; uniform float uTime; uniform float uWind; uniform vec2 uTuft; uniform float uKind; uniform float uQuad;
varying vec3 vGCol;
`;
const GRASS_VS_NORMAL = /* glsl */ `
ivec2 gS = ivec2(aSlot);
vec4 gA = texelFetch(uPlace, ivec2(gS.x * 2, gS.y), 0), gB = texelFetch(uPlace, ivec2(gS.x * 2 + 1, gS.y), 0);
float gYaw = gB.w; float gcy = cos(gYaw), gsy = sin(gYaw);
vec3 objectNormal = vec3(gcy * normal.x + gsy * normal.z, normal.y, -gsy * normal.x + gcy * normal.z);
`;
const GRASS_VS_BEGIN = /* glsl */ `
vec3 gp = position; float gf = clamp(gp.y, 0.0, 1.2);
bool gDead = gA.w < 0.004;                       // rejected instance: collapse every vertex far below the world (no flat sticks/discs left behind)
float gvar = 0.78 + 0.45 * fract(gYaw * 7.13);
gp.xz *= uTuft.x * gvar * (uQuad > 0.5 ? gA.w : 1.0);
gp.y *= gA.w * (uQuad > 0.5 ? 1.0 : 1.0);
gp.xz = vec2(gcy * gp.x + gsy * gp.z, -gsy * gp.x + gcy * gp.z);
vec2 gwd = vec2(0.82, 0.57);
float gph = dot(gA.xz, gwd) * 0.32 - uTime * 1.9 + gYaw;
float ggust = 0.55 + 0.45 * sin(uTime * 0.35 + dot(gA.xz, gwd) * 0.012 + 1.7);
float gamp = (0.03 + 0.07 * ggust) * uWind * (0.55 + 0.45 * gA.w) * uTuft.y;
gp.xz += gwd * (sin(gph) + 0.35 * sin(gph * 2.7 + 1.9)) * gamp * gf * gf * (uKind > 0.5 ? 1.6 : 1.0);
vec3 transformed = gDead ? vec3(0.0, -1.0e5, 0.0) : gA.xyz + gp; transformed.y -= 0.035;
vGCol = gB.rgb * mix(0.62, 1.12, clamp(gf, 0.0, 1.0));
`;

function createGrass(o) {
  const { ctx, atmo, terrainShared } = o, renderer = ctx.renderer;
  const group = new THREE.Group(); group.name = 'grass';
  const wind = o.site.wind ?? 0.5;
  const clumpTex = clumpTexture();
  const cross = clumpCross();
  const defs = [
    { name: 'blades',   W: 112, cell: 0.40, geo: bladeTuft(9, 11, 0.20, 0.8, 1.15, 0.010, 0.018), quad: 0, hRange: [0.34, 0.72], density: 1.00, scale: 1.0, kind: 0, inner: [-1, 0], tuftY: 1.0 },
    { name: 'clumps',   W: 160, cell: 0.50, geo: cross, quad: 1, hRange: [0.34, 0.60], density: 1.0, scale: 1.25, kind: 0, inner: [8.0, 14.0], tuftY: 1.0 },
    { name: 'tussocks', W: 96,  cell: 2.6,  geo: tussockBlob(), quad: 0, hRange: [0.45, 0.80], density: 0.9, scale: 2.0, kind: 0, inner: [34.0, 56.0], tuftY: 0.5 },
    { name: 'flowers',  W: 96,  cell: 3.0,  geo: flowerGeometry(5), quad: 0, hRange: [0.55, 1.05], density: 0.16, scale: 1.0, kind: 1, inner: [3.0, 6.0], tuftY: 1.0 },
  ];
  const wins = [];
  const bakeGeo = new THREE.BufferGeometry(); bakeGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  for (const d of defs) {
    const rt = new THREE.WebGLRenderTarget(d.W * 2, d.W, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
    const bu = {
      uCamCell: { value: new THREE.Vector2(1e9, 1e9) }, uW: { value: d.W }, uCellS: { value: d.cell }, uHalfR: { value: d.W * d.cell / 2 }, uHRange: { value: new THREE.Vector2(d.hRange[0], d.hRange[1]) },
      uDensity: { value: d.density }, uKind: { value: d.kind }, uInner: { value: new THREE.Vector2(d.inner[0], d.inner[1]) },
      uSeed: terrainShared.uSeed, uK: terrainShared.uK, uGroundY: terrainShared.uGroundY, uCurvC: terrainShared.uCurvC, uSeaY: terrainShared.uSeaY, uPadA: terrainShared.uPadA, uPadN: terrainShared.uPadN,
      uHT: terrainShared.uHT, uHC: terrainShared.uHC,
    };
    const bakeMat = new THREE.ShaderMaterial({ vertexShader: PLACE_VERT, fragmentShader: PLACE_FRAG, uniforms: bu, depthTest: false, depthWrite: false });
    const bakeMesh = new THREE.Mesh(bakeGeo, bakeMat); bakeMesh.frustumCulled = false;
    const bakeScene = new THREE.Scene(); bakeScene.add(bakeMesh);
    const ig = new THREE.InstancedBufferGeometry(); ig.index = d.geo.index; ig.attributes.position = d.geo.attributes.position; ig.attributes.normal = d.geo.attributes.normal; if (d.geo.attributes.uv) ig.attributes.uv = d.geo.attributes.uv;
    const slots = new Float32Array(d.W * d.W * 2); for (let i = 0; i < d.W * d.W; i++) { slots[i * 2] = i % d.W; slots[i * 2 + 1] = Math.floor(i / d.W); }
    ig.setAttribute('aSlot', new THREE.InstancedBufferAttribute(slots, 2)); ig.instanceCount = d.W * d.W;
    const mu = { uPlace: { value: rt.texture }, uTime: terrainShared.uTime, uWind: { value: wind }, uTuft: { value: new THREE.Vector2(d.scale, d.tuftY) }, uKind: { value: d.kind }, uQuad: { value: d.quad } };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0, side: THREE.DoubleSide, map: d.quad ? clumpTex : null, alphaTest: d.quad ? 0.42 : 0 });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, mu);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + GRASS_VS_DECL)
        .replace('#include <beginnormal_vertex>', GRASS_VS_NORMAL)
        .replace('#include <begin_vertex>', GRASS_VS_BEGIN);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGCol;')
        .replace('#include <color_fragment>', d.quad ? '#include <color_fragment>\ndiffuseColor.rgb = vGCol * (0.55 + 0.9 * diffuseColor.r);' : '#include <color_fragment>\ndiffuseColor.rgb = vGCol;')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection; nonPerturbedNormal = normal;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGCol * ' + (d.kind === 1 ? '0.22' : '0.045') + ';');
    };
    mat.customProgramCacheKey = () => 'sfGrass' + d.kind + d.quad;
    atmo.patchMaterial(mat);
    const mesh = new THREE.Mesh(ig, mat); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'grass-' + d.name; mesh.renderOrder = 20;
    group.add(mesh);
    wins.push({ d, rt, bu, bakeMat, bakeScene, mesh, ig, mat, cx: NaN, cz: NaN, dirty: 0 });
  }
  function bake(w, cx, cz) {
    w.bu.uCamCell.value.set(cx, cz);
    const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear; renderer.autoClear = false;
    renderer.setRenderTarget(w.rt); renderer.render(w.bakeScene, bakeCam);
    renderer.setRenderTarget(prevRT); renderer.autoClear = prevAuto;
    w.cx = cx; w.cz = cz;
  }
  return {
    group, wins,
    bakeAll(cam) { for (const w of wins) bake(w, Math.floor(cam.x / w.d.cell), Math.floor(cam.z / w.d.cell)); },
    update(cam, t, dt) {
      for (const w of wins) {
        const cx = Math.floor(cam.x / w.d.cell), cz = Math.floor(cam.z / w.d.cell);
        w.dirty += dt;
        if (cx !== w.cx || cz !== w.cz || w.dirty > 1.0) { bake(w, cx, cz); w.dirty = 0; }
      }
    },
    compile() { return Promise.all(wins.map((w) => (renderer.compileAsync ? renderer.compileAsync(w.bakeScene, bakeCam) : Promise.resolve()))); },
    dispose() { for (const w of wins) { w.rt.dispose(); w.bakeMat.dispose(); w.ig.dispose(); w.mat.dispose(); } clumpTex.dispose(); bakeGeo.dispose(); },
  };
}

export function createFlora(o) {
  const group = new THREE.Group(); group.name = 'flora';
  const parts = [];
  if (o.biome === 'asphodel') { const g = createGrass(o); parts.push(g); group.add(g.group); }
  if (o.scatterFactory) {
    try { const sf = o.scatterFactory(o); if (sf) { parts.push(sf); group.add(sf.group); } } catch (e) { console.error('[flora] scatter failed', e); }
  }
  const colliders = []; for (const p of parts) if (p.colliders) colliders.push(...p.colliders);
  return {
    group, colliders,
    bakeAll(cam) { for (const p of parts) p.bakeAll?.(cam); },
    update(cam, t, dt) { for (const p of parts) p.update?.(cam, t, dt); },
    collide(p, r, h) { for (const q of parts) q.collide?.(p, r, h); },
    compile() { return Promise.all(parts.map((p) => p.compile?.())); },
    dispose() { for (const p of parts) p.dispose?.(); },
  };
}
