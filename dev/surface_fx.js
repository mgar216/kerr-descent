// ORPHEUS · stand-alone FX harness. Builds src/world/terrain/fx.js on the real CPU heightfield + atmosphere (synthetic ground mesh, sun, sky dome,
// placeholder ship, HDR target + lens-style tone map) so touchdown / lift-off bursts, ambient volumes and geysers can be screenshotted mid-effect.
//   http://localhost:5173/dev/surface_fx.html?biome=cocytus&site=wailing&clean=1
// params: biome, site, sun (elev°), az (°), exp, t (start time s), cam=x,y,z,tx,ty,tz, noship=1, grid (ground samples per side), pause=1, burst=touchdown|liftoff[,secs]
// window.__fx = { env, fx, hf, atmo, scene, camera, controls, renderer, T, paused, burst(kind,strength), jump(t), shot(kind, secs, strength), cam(x,y,z,tx,ty,tz), stats() }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SITES, BODY_FALLBACK, LOOKS, dirFromAzEl } from '../src/world/terrain/sites.js';
import { Heightfield, makeFeatures } from '../src/world/terrain/biomes.js';
import { Atmosphere } from '../src/world/terrain/atmosphere.js';
import { createSurfaceFx } from '../src/world/terrain/fx.js';

const Q = new URLSearchParams(location.search);
const biome = Q.get('biome') || 'cocytus';
const siteId = Q.get('site') || Object.keys(SITES[biome])[0];
const def = SITES[biome][siteId];
const look = LOOKS[biome];
if (Q.has('clean')) document.body.classList.add('clean');

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance', preserveDrawingBuffer: true, alpha: false, stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
const near = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.05, 3e5);
const bgScene = new THREE.Scene();
let rt = null;
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  rt?.dispose(); rt = new THREE.WebGLRenderTarget(renderer.domElement.width, renderer.domElement.height, { type: THREE.HalfFloatType, depthBuffer: true, samples: 4 });
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ───────────── background stand-in + tone map (same as dev/surface.js) ─────────────
const bgUniforms = { uSun: { value: new THREE.Vector3(0, 1, 0) }, uExp: { value: +(Q.get('exp') ?? 1) }, uMode: { value: biome === 'elysium' ? 1 : 0 } };
const bgMat = new THREE.ShaderMaterial({
  uniforms: bgUniforms, depthTest: false, depthWrite: false, side: THREE.BackSide,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = vec4(p.xy, p.w, p.w); }`,
  fragmentShader: `
    uniform vec3 uSun; uniform float uExp; uniform float uMode; varying vec3 vDir;
    float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    void main(){
      vec3 d = normalize(vDir); vec3 col = vec3(0.0);
      vec3 g = d * 260.0; vec3 id = floor(g); vec3 f = fract(g) - 0.5; float h = h13(id);
      col += vec3(1.0, 0.95, 0.9) * step(0.982, h) * smoothstep(0.42, 0.0, length(f)) * (0.35 + 0.9 * h13(id + 7.3)) * 0.9;
      vec3 g2 = d * 90.0; vec3 id2 = floor(g2); vec3 f2 = fract(g2) - 0.5; float h2 = h13(id2 + 3.1);
      col += vec3(0.8, 0.9, 1.0) * step(0.992, h2) * smoothstep(0.45, 0.0, length(f2)) * 1.6;
      float band = exp(-pow(dot(d, normalize(vec3(0.25, 0.8, 0.3))) * 3.2, 2.0)); col += vec3(0.05, 0.06, 0.09) * band;
      vec3 s = normalize(uSun); float ang = degrees(acos(clamp(dot(d, s), -1.0, 1.0)));
      if (uMode < 0.5) {
        float ring = exp(-pow((ang - 6.6) / 0.85, 2.0)), glow = exp(-ang / 5.5) * 0.35;
        col = mix(col, vec3(0.0), smoothstep(6.1, 5.4, ang));
        col += vec3(1.0, 0.52, 0.16) * (ring * 7.5) + vec3(1.0, 0.45, 0.12) * glow * smoothstep(5.0, 6.5, ang);
      } else {
        vec3 u = normalize(cross(s, vec3(0.0, 1.0, 0.01))), v = cross(s, u); vec2 q = vec2(dot(d, u), dot(d, v)) / max(dot(d, s), 0.05);
        float r = length(q) * 2.4, th = atan(q.y, q.x);
        float arm = 0.5 + 0.5 * cos(2.0 * (th - 3.2 * log(r + 0.05)));
        float gal = exp(-r * r * 0.5) * (0.35 + 0.65 * arm) * step(0.0, dot(d, s));
        col += vec3(0.55, 0.68, 1.0) * gal * 0.9 + vec3(0.9, 0.95, 1.0) * exp(-r * r * 40.0) * 0.8;
      }
      gl_FragColor = vec4(col * uExp, 1.0);
    }`,
});
const bgMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), bgMat); bgMesh.frustumCulled = false; bgScene.add(bgMesh);
const post = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMat = new THREE.ShaderMaterial({
  uniforms: { tex: { value: null }, uExposure: { value: 1 } }, depthTest: false, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tex; uniform float uExposure; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
    void main(){
      vec3 c = texture2D(tex, vUv).rgb * uExposure;
      float L = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(L), c, 1.08);
      float Lh = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6); float Lt = Lh*(1.0 + Lh/36.0)/(1.0 + Lh);
      vec3 hp = c*(Lt/Lh); hp = mix(hp, vec3(Lt), smoothstep(1.5, 12.0, Lh)*0.7);
      c = mix(aces(c), min(hp, vec3(1.0)), 0.5);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
      #include <colorspace_fragment>
    }`,
});
const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const postMesh = new THREE.Mesh(tri, postMat); postMesh.frustumCulled = false; post.add(postMesh);

// ───────────── real heightfield / features / atmosphere ─────────────
const GROUND = -4.6, padCenter = [0, 18], padR0 = 33, padR1 = 59;
const body = { id: biome, ...BODY_FALLBACK[biome], radiusM: BODY_FALLBACK[biome].radiusKm * 1000 };
const hf = new Heightfield(biome, def, { groundY0: GROUND, radiusM: body.radiusM, padCenter, padR0, padR1 });
const features = makeFeatures(biome, def, hf);
const atmo = new Atmosphere(biome, body, look);
let seaY = null; if (biome === 'asphodel' && def.terrain.seaOn) seaY = GROUND - hf.h0;
const sunDir = new THREE.Vector3(...dirFromAzEl(+(Q.get('az') ?? def.look.az), +(Q.get('sun') ?? def.look.elev)));
atmo.setSun([sunDir.x, sunDir.y, sunDir.z], 1);
const dome = atmo.createDome(); if (dome) near.add(dome);

// lights (same names the real surface module uses; fx.js picks them up)
const sun = new THREE.DirectionalLight(0xffffff, look.sunI); sun.name = 'surface-sun'; sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
{ const sc = sun.shadow.camera; sc.left = -96; sc.right = 96; sc.top = 96; sc.bottom = -96; sc.near = 20; sc.far = 800; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; }
const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1); hemi.name = 'surface-hemi';
near.add(sun, sun.target, hemi);
function applyLights() {
  sun.color.copy(atmo.sunColor); sun.intensity = atmo.sunIntensity;
  hemi.color.copy(atmo.hemiSky); hemi.groundColor.copy(atmo.hemiGround); hemi.intensity = atmo.hemiIntensity;
}
applyLights();

// ground mesh (samples the real CPU heightfield)
{
  const N = +(Q.get('grid') ?? 200), S = 1400, geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const pal = { asphodel: ['#4a5642', '#7a8568'], phlegethon: ['#141211', '#2b2724'], charon: ['#48453f', '#7a756c'], cocytus: ['#a3b9cc', '#dce7f1'], elysium: ['#080b16', '#1b2540'] }[biome];
  const c0 = new THREE.Color(pal[0]), c1 = new THREE.Color(pal[1]), tmp = new THREE.Color();
  const hash = (x, y) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = hf.groundY(x, z); p.setY(i, y);
    const n = 0.5 + 0.5 * Math.sin(x * 0.043 + Math.sin(z * 0.031) * 2.0) * Math.cos(z * 0.052 + x * 0.011), v = hash(Math.round(x / 7), Math.round(z / 7)) * 0.25;
    tmp.copy(c0).lerp(c1, Math.min(1, n * 0.8 + v)); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mat = atmo.patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }));
  const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; near.add(ground);
}
if (seaY !== null) {
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), atmo.patchMaterial(new THREE.MeshStandardMaterial({ color: 0x1f6f7a, roughness: 0.2, metalness: 0.1 })));
  sea.position.y = seaY; near.add(sea);
}
if (features.river) { // lava ribbon + glow light
  const r = features.river, pos = [], idx = [];
  for (let z = -700, i = 0; z <= 700; z += 4, i++) { const x = r.cx(z), y = hf.groundY(x, z) + 0.12; pos.push(x - r.wLava, y, z, x + r.wLava, y, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  near.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.5, 0.3), toneMapped: false, side: THREE.DoubleSide })));
  const l = new THREE.PointLight(0xff6a22, 90, 60, 2); l.position.set(r.cx(0), hf.groundY(r.cx(0), 0) + 2.2, 0); near.add(l);
}
for (const v of (def.vents || [])) { // visible vent marker (dark crater)
  const m = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a1018 }));
  m.position.set(v.x, hf.groundY(v.x, v.z) + 0.05, v.z); near.add(m);
}
let shipGroup = null;
if (!Q.has('noship')) { // placeholder ship (shape + shadow + scale)
  const g = new THREE.Group(); g.name = 'ship-placeholder';
  const white = atmo.patchMaterial(new THREE.MeshStandardMaterial({ color: 0xcfd3d5, roughness: 0.5, metalness: 0.25 }));
  const dark = atmo.patchMaterial(new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6, metalness: 0.5 }));
  const cy = GROUND + 6.0;
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); };
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 40, 28).rotateX(Math.PI / 2), white), 0, cy, 13);
  add(new THREE.Mesh(new THREE.ConeGeometry(3.3, 8.5, 28).rotateX(-Math.PI / 2), white), 0, cy, -11.25);
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.3, 2.4, 6, 24).rotateX(Math.PI / 2), dark), 0, cy, 36);
  for (const sx of [-1, 1]) for (const z of [26, 33]) add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 7), white), sx * 4.2, cy + 0.2, z);
  for (const [x, z] of [[-3.8, -2], [3.8, -2], [-3.8, 30], [3.8, 30]]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.6, 10), dark), x, GROUND + 2.7, z);
  near.add(g); shipGroup = g;
}

// ───────────── fx ─────────────
const ctx = { THREE, renderer, scenes: { near }, cameras: { near: camera } };
const env = { THREE, ctx, biome, siteId, site: def, groundY: (x, z) => hf.groundY(x, z), camera, sunDir, palette: {}, features, shipPad: { x: padCenter[0], z: padCenter[1], r: padR0 } };
const t0 = performance.now();
const fx = createSurfaceFx(env);
const buildMs = performance.now() - t0;
near.add(fx.group);

// ───────────── camera / loop ─────────────
const controls = new OrbitControls(camera, canvas); controls.enableDamping = false;
function cam(x, y, z, tx, ty, tz) { camera.position.set(x, y, z); controls.target.set(tx, ty, tz); controls.update(); camera.updateMatrixWorld(); }
if (Q.has('cam')) cam(...Q.get('cam').split(',').map(Number)); else cam(-60, 18, 95, 0, 3, 14);

let T = +(Q.get('t') ?? 0), paused = Q.has('pause'), ema = 16;
function renderOnce() {
  atmo.setSun([sunDir.x, sunDir.y, sunDir.z], 1); applyLights();
  sun.target.position.set(controls.target.x, GROUND, controls.target.z); sun.position.copy(sun.target.position).addScaledVector(sunDir, 380);
  sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  bgUniforms.uSun.value.copy(sunDir);
  renderer.setRenderTarget(rt); renderer.autoClear = true; renderer.setClearColor(0x000000, 1); renderer.clear();
  renderer.autoClear = false; renderer.render(bgScene, camera);
  renderer.clearDepth(); renderer.render(near, camera);
  renderer.setRenderTarget(null); renderer.autoClear = true; postMat.uniforms.tex.value = rt.texture; renderer.render(post, postCam);
}
let last = performance.now();
const infoEl = document.getElementById('info');
function frame() {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (!paused) T += dt;
  controls.update();
  fx.update(paused ? 0 : dt, T, camera.position);
  renderOnce();
  ema += (dt * 1000 - ema) * 0.1;
  if (!Q.has('clean')) { const i = fx.info(); infoEl.textContent = `${biome}/${siteId}  T=${T.toFixed(2)}${paused ? ' (paused)' : ''}  ${ema.toFixed(1)} ms  draw ${i.calls}  verts ${i.verts}  build ${buildMs.toFixed(0)} ms\ngeyser ${fx.geyserLevel(camera.position).toFixed(3)}`; }
  requestAnimationFrame(frame);
}

const api = {
  THREE, env, fx, hf, atmo, scene: near, camera, controls, renderer, buildMs,
  get T() { return T; }, set T(v) { T = v; }, get paused() { return paused; }, set paused(v) { paused = !!v; },
  burst(kind = 'touchdown', strength = 1) { fx.update(0, T, camera.position); fx.burst(kind, padCenter[0], padCenter[1], strength); },
  jump(t) { T = t; fx.update(0, T, camera.position); renderOnce(); },
  /** trigger a burst now, then freeze `secs` seconds later */
  shot(kind = 'touchdown', secs = 2.5, strength = 1) { paused = true; fx.update(0, T, camera.position); fx.burst(kind, padCenter[0], padCenter[1], strength); T += secs; fx.update(0, T, camera.position); renderOnce(); return T; },
  cam, stats: () => ({ ...fx.info(), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs?.length, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, ms: ema, buildMs }),
  render: renderOnce, sheet, sheetOff, ship(v) { if (shipGroup) shipGroup.visible = !!v; },
};
window.__fx = api;

const ui = document.getElementById('ui');
ui.innerHTML = `<b>${biome}/${siteId}</b> · FX harness · build ${buildMs.toFixed(0)} ms<br>
<button id="bT">touchdown</button><button id="bL">lift-off</button><button id="bP">pause/play</button><button id="bS">+1 s</button>`;
/** contact sheet: frames = array of () => void that set up a view (T, camera); each is rendered into one tile of a 2D overlay canvas */
function sheet(frames, cols = 3, tw = 512) {
  const th = Math.round(tw * innerHeight / innerWidth);
  let cv = document.getElementById('sheet');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'sheet'; cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9;background:#000;object-fit:contain'; document.body.appendChild(cv); }
  cv.width = cols * tw; cv.height = Math.ceil(frames.length / cols) * th;
  const g = cv.getContext('2d');
  frames.forEach((fn, i) => { fn(); renderOnce(); g.drawImage(canvas, (i % cols) * tw, Math.floor(i / cols) * th, tw, th); });
}
function sheetOff() { document.getElementById('sheet')?.remove(); }
ui.querySelector('#bT').onclick = () => { paused = false; api.burst('touchdown'); };
ui.querySelector('#bL').onclick = () => { paused = false; api.burst('liftoff'); };
ui.querySelector('#bP').onclick = () => { paused = !paused; };
ui.querySelector('#bS').onclick = () => { T += 1; };
if (Q.get('burst')) { const [k, s] = Q.get('burst').split(','); api.shot(k, +(s || 2.5)); }
frame();
