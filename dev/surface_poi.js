// ORPHEUS · stand-alone POI prop harness. Builds `src/world/terrain/poi_<biome>.js` on a synthetic heightfield with a sun + sky fill.
//   http://localhost:5173/dev/surface_poi.html?biome=asphodel&site=meadow&slot=outpost&sun=36&az=-35&clean=1
// Debug handle: window.__poi = { env, result, scene, camera, controls, focus(slotId, dist, azDeg, elDeg), cam(x,y,z,tx,ty,tz), use(id), say[] }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SITES, BODY_FALLBACK, LOOKS, dirFromAzEl, TAU } from '../src/world/terrain/sites.js';
import { createPoiEnv, disposeTree } from '../src/world/terrain/poi_common.js';

const Q = new URLSearchParams(location.search);
const biome = Q.get('biome') || 'asphodel';
const siteId = Q.get('site') || Object.keys(SITES[biome])[0];
const site = SITES[biome][siteId];
const SUN_EL = +(Q.get('sun') ?? site.look.elev), SUN_AZ = +(Q.get('az') ?? site.look.az);
if (Q.has('clean')) document.body.classList.add('clean');

const canvas = document.getElementById('gl');
const W = Math.min(innerWidth, 1280), H = Math.min(innerHeight, 720);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = +(Q.get('exp') ?? 1.0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 20000);

// ───────────── synthetic heightfield (stand-in for the real terrain; props only need groundY/groundNormal) ─────────────
const hash = (x, y) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sm = (t) => t * t * (3 - 2 * t);
function vnoise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1); const u = sm(fx), v = sm(fy); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; }
function fbm(x, y, o = 4) { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * (vnoise(x, y) - 0.5) * 2; x = x * 2.03 + 11.7; y = y * 2.03 - 5.3; a *= 0.5; } return s; }
const T = site.terrain, GROUND0 = -4.6;
const slots = Object.values(site.slots);
const river = T.river || null;
let seaRel = null;
const coastN = T.coast ? [Math.sin(T.coast.bearing * Math.PI / 180), -Math.cos(T.coast.bearing * Math.PI / 180)] : null;
const landDist = (x, z) => T.coast.d + T.coast.wob * fbm((x * -coastN[1] + z * coastN[0]) / T.coast.wobWave, 0.3, 2) - (x * coastN[0] + z * coastN[1]);
const elev = (land) => (land >= 0 ? 2.6 * (1 - Math.exp(-land / 28)) : -9 * (1 - Math.exp(land / 140)));
function rawH(x, z) {
  let h = fbm(x / 140, z / 140, 4) * (biome === 'charon' ? 2.2 : biome === 'elysium' ? 1.8 : 2.6) + fbm(x / 18, z / 18, 2) * 0.25;
  if (T.coast) { const l = landDist(x, z); h = elev(l) + h * 0.5 * Math.min(1, Math.max(0, l / 90)); }
  if (river) { const d = Math.abs(river.dist(x, z)); h -= river.carve * (1 - sm(Math.min(1, Math.max(0, (d - river.wLava * 0.5) / (river.wChannel - river.wLava * 0.5))))); }
  return h;
}
const h0 = rawH(0, 18);
if (T.coast) seaRel = -h0;
function groundY(x, z) {
  let h = rawH(x, z) - h0;
  const pads = [{ x: 0, z: 18, r0: 30, r1: 56, y: 0 }, ...slots.filter((s) => s.padR > 0).map((s) => ({ x: s.x, z: s.z, r0: s.padR, r1: s.padR * 1.9, y: rawH(s.x, s.z) - h0 }))];
  for (const p of pads) { const d = Math.hypot(x - p.x, z - p.z); const w = 1 - sm(Math.min(1, Math.max(0, (d - p.r0) / (p.r1 - p.r0)))); h = h + (p.y - h) * w; }
  return GROUND0 + h;
}
const _n = new THREE.Vector3();
function groundNormal(x, z, out = _n) { const e = 0.6, hx = groundY(x + e, z) - groundY(x - e, z), hz = groundY(x, z + e) - groundY(x, z - e); return out.set(-hx, 2 * e, -hz).normalize(); }

// ───────────── lights + sky ─────────────
const look = LOOKS[biome];
const sunDir = new THREE.Vector3(...dirFromAzEl(SUN_AZ, SUN_EL));
const sun = new THREE.DirectionalLight(new THREE.Color(...look.sunCol), look.sunI);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 400; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(new THREE.Color(...look.hemiSky), new THREE.Color(...look.hemiGround), look.hemiI);
scene.add(hemi);
const skyCols = { asphodel: ['#7fb4d8', '#d9d2c0'], phlegethon: ['#3a2418', '#a8683a'], charon: ['#000000', '#05060a'], cocytus: ['#6f8fb0', '#b9c8d4'], elysium: ['#0a0f26', '#25306a'] }[biome];
const skyTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, skyCols[0]); gr.addColorStop(1, skyCols[1]); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false }));
skyDome.rotation.y = 0; skyDome.scale.y = 1; scene.add(skyDome);
// map: sphere v=1 at top; texture y=0 is top of canvas → flip
skyTex.flipY = true;
scene.fog = new THREE.FogExp2(new THREE.Color(skyCols[1]).convertSRGBToLinear(), { asphodel: 0.0011, phlegethon: 0.0028, charon: 0, cocytus: 0.0022, elysium: 0.0016 }[biome]);

// ground mesh
{
  const N = 220, S = 900, geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const base = new THREE.Color({ asphodel: '#6b7367', phlegethon: '#262322', charon: '#6f6a64', cocytus: '#b3cadc', elysium: '#1a2336' }[biome]);
  const dark = base.clone().multiplyScalar(0.55);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = groundY(x, z); p.setY(i, y);
    const t = 0.5 + 0.5 * fbm(x / 9, z / 9, 3), c = dark.clone().lerp(base, t);
    if (T.coast && y < seaLevel() + 0.5) c.set('#16171a');
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); ground.receiveShadow = true; scene.add(ground);
}
function seaLevel() { return GROUND0 + (seaRel ?? -1e9); }
if (T.coast) {
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1f8f9a, transparent: true, opacity: 0.7, roughness: 0.15 }));
  sea.position.y = seaLevel(); scene.add(sea);
}
if (river) { // visible lava ribbon so riverside props read in context
  const pts = []; for (let z = -400; z <= 300; z += 4) pts.push(z);
  const pos = [], idx = [];
  pts.forEach((z, i) => { const x = river.cx(z), y = groundY(x, z) + 0.15; pos.push(x - river.wLava, y, z, x + river.wLava, y, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.4, 0.25), toneMapped: false, side: THREE.DoubleSide })));
  const l = new THREE.PointLight(0xff6a20, 60, 60, 2); l.position.set(river.cx(-100), groundY(river.cx(-100), -100) + 1.5, -100); scene.add(l);
}
// ship-scale placeholder at the pad (box hull, nose at z ≈ -9, nozzle at +46)
if (!Q.has('noship')) {
  const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 54), new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.6 })); hull.position.set(0, GROUND0 + 6.5, 18); hull.castShadow = true; hull.receiveShadow = true; scene.add(hull);
}

// ───────────── fake ctx ─────────────
const logEl = document.getElementById('log'); const sayLog = [];
const lg = (...a) => { const s = a.join(' '); sayLog.push(s); logEl.textContent = sayLog.slice(-8).join('\n'); console.log('[poi]', s); };
const handlers = new Map();
const ctx = {
  THREE, renderer, say: (id) => lg('say', id), sayText: (w, t) => lg('sayText', w, t),
  codex: { unlock: (id) => lg('codex.unlock', id), isUnlocked: () => false },
  bus: { on: (e, f) => { (handlers.get(e) || handlers.set(e, []).get(e)).push(f); }, off() {}, emit: (e, p) => { lg('bus.emit', e, JSON.stringify(p)); (handlers.get(e) || []).forEach((f) => f(p)); } },
  audio: { ready: false }, flags: { once: (k, f) => f(), get: () => null, set() {} }, ui: { toast: (h) => lg('toast', h), prompt: () => {} },
};

// ───────────── build POIs ─────────────
const body = BODY_FALLBACK[biome];
const features = {};
if (river) features.river = river;
const env = createPoiEnv({ ctx, bodyId: biome, siteId, site, body, groundY, groundNormal, seaLevelY: T.coast ? seaLevel() : null, features, sunDir, fog: (m) => m, envMap: null, shipPad: { x: 0, z: 18, r: 34 } });
let result = null, buildMs = 0;
try {
  const mod = await import(`../src/world/terrain/poi_${biome}.js`);
  const t0 = performance.now();
  result = mod.buildPois(env);
  buildMs = performance.now() - t0;
  scene.add(result.group);
  result.group.traverse((o) => { if (o.isMesh && o.userData.noShadow !== true && o.castShadow === undefined) { /* leave to builder */ } });
  lg('built', biome, siteId, `${buildMs.toFixed(1)} ms`, `interactables=${result.interactables?.length ?? 0}`, `colliders=${result.colliders?.length ?? 0}`);
} catch (e) { lg('BUILD FAILED', e.message); console.error(e); }

// stats
let draw = 0, tris = 0;
if (result) result.group.traverse((o) => { if (o.isMesh) { draw++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
const lights = []; if (result) result.group.traverse((o) => { if (o.isLight) lights.push(o); });

// ───────────── camera / controls ─────────────
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false; controls.maxPolarAngle = Math.PI * 0.499;
function focus(slotId, dist = 16, azDeg = 25, elDeg = 14, height = 1.6) {
  const s = site.slots[slotId] || Object.values(site.slots)[0];
  const tx = s.x, tz = s.z, ty = groundY(tx, tz) + height;
  // azimuth relative to the direction from the slot toward the ship (so az 0 views the 'front')
  const base = Math.atan2(-tx, -tz) /* yaw facing ship */; const a = base + azDeg * Math.PI / 180, e = elDeg * Math.PI / 180;
  camera.position.set(tx + Math.sin(a) * Math.cos(e) * dist, ty + Math.sin(e) * dist, tz + Math.cos(a) * Math.cos(e) * dist);
  controls.target.set(tx, ty, tz); controls.update(); render();
}
function cam(x, y, z, tx, ty, tz) { camera.position.set(x, y, z); controls.target.set(tx, ty, tz); controls.update(); render(); }
const firstSlot = Q.get('slot') || Object.keys(site.slots)[0];
focus(firstSlot, +(Q.get('dist') ?? 16), +(Q.get('caz') ?? 25), +(Q.get('cel') ?? 14), +(Q.get('h') ?? 1.6));
if (Q.has('cam')) { const v = Q.get('cam').split(',').map(Number); cam(...v); }

// UI
const ui = document.getElementById('ui');
ui.innerHTML = `<b>${biome}/${siteId}</b> · build ${buildMs.toFixed(0)} ms · meshes ${draw} · tris ${(tris / 1000).toFixed(0)}k · lights ${lights.length}<br>` +
  Object.keys(site.slots).map((k) => `<button data-slot="${k}">${k}</button>`).join('') +
  '<br>' + (result?.interactables || []).map((it) => `<button data-use="${it.id}" title="${typeof it.label === 'function' ? it.label() : it.label}">use ${it.id}</button>`).join('');
ui.addEventListener('click', (e) => { const t = e.target; if (t.dataset.slot) focus(t.dataset.slot, 16, 25, 14); if (t.dataset.use) use(t.dataset.use); });
function use(id) { const it = result?.interactables?.find((i) => i.id === id); if (it) it.use(); return !!it; }

// loop
let lastT = performance.now(), T0 = 0;
function render() { sun.position.copy(controls.target).addScaledVector(sunDir, 200); sun.target.position.copy(controls.target); sun.target.updateMatrixWorld(); skyDome.position.copy(camera.position); renderer.render(scene, camera); }
function frame() { const now = performance.now(), dt = Math.min((now - lastT) / 1000, 0.1); lastT = now; T0 += dt; result?.update?.(dt, T0, camera.position); controls.update(); render(); requestAnimationFrame(frame); }
frame();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

window.__poi = { THREE, env, result, scene, camera, controls, renderer, focus, cam, use, say: sayLog, stats: { buildMs, draw, tris, lights: lights.length }, sun, hemi, groundY };
