// Standalone viewer for src/ship/model.js — fake ctx, stand-in env key light, orbit/fly cameras, HDR bloom + lens tone map like core.
// URL params: variant=orpheus|eurydice  view=orbit|fly  room=<id>  cam=x,y,z,tx,ty,tz[,fov]  landed=1  ramp=1  thrust=0..1  boost=0..1  mode=normal|alert|emergency|off
//             key=<intensity> exp=<exposure> post=0|1  ui=0|1  live=1  az=<deg> el=<deg> (key light direction)  hide=1 (hide hull exterior meshes: interior-only view)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const Q = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const state = { variant: Q.get('variant') === 'eurydice' ? 'eurydice' : 'orpheus', view: Q.get('view') || 'orbit', landed: Q.get('landed') === '1', ramp: Q.get('ramp') === '1', thrust: +(Q.get('thrust') || 0), boost: +(Q.get('boost') || 0), mode: Q.get('mode') || null, key: +(Q.get('key') || 3.0), exp: +(Q.get('exp') || 1), post: Q.get('post') !== '0', live: Q.get('live') === '1', az: +(Q.get('az') || 35), el: +(Q.get('el') || 38), hide: Q.get('hide') === '1', hideInt: Q.get('hideint') === '1' };

const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 4000);
scene.add(camera);

// env stand-ins (core owns the real ones): shadowed key light + faint hemisphere fill
const key = new THREE.DirectionalLight(0xfff1e2, state.key);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 160 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
key.target.position.set(0, 0, 20); scene.add(key, key.target);
const hemi = new THREE.HemisphereLight(0x9adfff, 0x0b0d12, 0.07); scene.add(hemi);
function setKeyDir() { const a = state.az * Math.PI / 180, e = state.el * Math.PI / 180; key.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(90).add(key.target.position); key.intensity = state.key; }
setKeyDir();
// stars
{ const n = 2500, p = new Float32Array(n * 3); let s = 12345; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1, th = r() * 6.283, q = Math.sqrt(1 - u * u); p.set([q * Math.cos(th) * 1800, u * 1800, q * Math.sin(th) * 1800], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(2, 2, 2.4), size: 1.4, sizeAttenuation: false, toneMapped: false, depthWrite: false }))); }

// ───────── fake ctx ─────────
const handlers = {}; const logEl = $('#log'); const logLines = [];
const bus = { on(e, f) { (handlers[e] = handlers[e] || new Set()).add(f); }, off(e, f) { handlers[e] && handlers[e].delete(f); }, emit(e, p) { (handlers[e] || []).forEach((f) => f(p)); if (e === 'interact') { logLines.push('interact → ' + p.id); logEl.textContent = logLines.slice(-6).join('\n'); } } };
const view = { exposure: state.exp };
const ctx = { THREE, renderer, scenes: { near: scene }, cameras: { near: camera }, view, bus, audio: null, settings: {}, flags: {}, spaces: {}, units: {} };

// ───────── post: bloom + lens tone map (same operators as core) ─────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.045, 0.5, 0.0); composer.addPass(bloom);
const lens = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uExposure: { value: state.exp }, uSat: { value: 1.08 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uExposure; uniform float uSat; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure; float L = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(L), c, uSat);
      float Lh = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6); float Lt = Lh*(1.0 + Lh/36.0)/(1.0 + Lh); vec3 hp = c*(Lt/Lh); hp = mix(hp, vec3(Lt), smoothstep(1.5, 12.0, Lh)*0.7);
      c = mix(aces(c), min(hp, vec3(1.0)), 0.5); vec2 dc = vUv - 0.5; float v = smoothstep(1.05, 0.25, length(dc*vec2(1.0, 0.82))); c *= mix(1.0, v, 0.5); gl_FragColor = vec4(max(c, 0.0), 1.0); }`,
});
composer.addPass(lens); composer.addPass(new OutputPass());

// ───────── ship ─────────
let ship = null, buildMs = 0;
async function load() {
  const mod = await import('../src/ship/model.js?' + Date.now());
  const t0 = performance.now();
  if (ship) { scene.remove(ship.group); ship.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  ship = mod.buildShip(ctx, { variant: state.variant, landed: state.landed, only: Q.get('parts') ? Q.get('parts').split(',') : null });
  buildMs = performance.now() - t0;
  scene.add(ship.group);
  ship.setThrust(state.thrust, state.boost); ship.setLanded(state.landed); ship.setRamp && ship.setRamp(state.ramp);
  if (state.mode) ship.interiorLights(state.mode);
  applyHide(); buildUI(); dirty = true;
  window.__ship.ship = ship;
}
function applyHide() { if (!ship) return; ship.group.children.forEach((o) => { if (!o.isMesh) return; if (/\.ext$/.test(o.name)) o.visible = !state.hide; else if (state.hideInt && !/^(screen|decal|signs)/.test(o.name)) o.visible = false; else o.visible = true; }); }

// ───────── cameras ─────────
const orbit = { target: new THREE.Vector3(0, -0.5, 20), dist: 80, az: -35, el: 20 };
const fly = { pos: new THREE.Vector3(0, 0.46, 3), yaw: 0, pitch: 0, fov: 70 };
let dirty = true;
function applyCam() {
  if (state.view === 'orbit') {
    const a = orbit.az * Math.PI / 180, e = orbit.el * Math.PI / 180;
    camera.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(orbit.dist).add(orbit.target);
    camera.lookAt(orbit.target); camera.fov = 45;
  } else {
    camera.position.copy(fly.pos); camera.rotation.set(fly.pitch, fly.yaw, 0, 'YXZ'); camera.fov = fly.fov;
  }
  camera.near = state.view === 'orbit' ? 0.5 : 0.03; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
function setFly(x, y, z, tx, ty, tz, fov = 70) {
  state.view = 'fly'; fly.pos.set(x, y, z); const d = new THREE.Vector3(tx - x, ty - y, tz - z).normalize();
  fly.yaw = Math.atan2(-d.x, -d.z); fly.pitch = Math.asin(d.y); fly.fov = fov; dirty = true; buildUI();
}
function setOrbit(az, el, dist, tx = 0, ty = -0.5, tz = 20) { state.view = 'orbit'; orbit.az = az; orbit.el = el; orbit.dist = dist; orbit.target.set(tx, ty, tz); dirty = true; buildUI(); }
const ROOM_CAMS = { // eye position + look-at per room (interior standing eye y = 0.46)
  cockpit: [0, 0, 0, 0, 0, -10], flightdeck: [0.2, 0.46, 2.1, 0, -0.2, -0.5], corridor: [0, 0.46, 3.0, 0, 0.2, 20], quarters: [-1.5, 0.46, 3.4, -3.6, -0.3, 6.4], galley: [-1.5, 0.46, 8.4, -3.6, -0.3, 11.5],
  airlock: [-1.5, 0.46, 14.4, -3.8, -0.3, 16.8], lab: [1.5, 0.46, 3.4, 3.7, -0.3, 7], medbay: [1.5, 0.46, 10.4, 3.7, -0.3, 12.6], core: [1.5, 0.46, 14.4, 3.7, -0.2, 16.6],
  dome: [0.4, 3.0, 8.6, 0, 3.4, 12], cargo: [0, 0.46, 24.4, 0, -0.4, 31], engineering: [2.4, 0.46, 31.4, -0.4, -0.2, 36],
};
const EXT_VIEWS = { front34: [-35, 18, 85], rear34: [150, 18, 85], side: [-90, 4, 90], top: [-30, 80, 85], belly: [-30, -55, 85], front: [0, 6, 85], rear: [180, 8, 85], nose: [-30, 14, 22], tail: [150, 12, 30] };
function gotoRoom(id) { const c = ROOM_CAMS[id]; if (c) setFly(...c); }
function gotoExt(id) { const v = EXT_VIEWS[id]; if (!v) return; const [az, el, d] = v; if (id === 'nose') return setOrbit(az, el, d, 0, -0.5, 0); if (id === 'tail') return setOrbit(az, el, d, 0, 0, 40); setOrbit(az, el, d); }

// ───────── UI ─────────
function buildUI() {
  const ui = $('#ui'); if (Q.get('ui') === '0') { ui.style.display = 'none'; $('#stat').style.display = 'none'; $('#log').style.display = 'none'; return; }
  const btn = (txt, fn, on) => { const b = document.createElement('button'); b.textContent = txt; if (on) b.className = 'on'; b.onclick = () => { fn(); dirty = true; }; return b; };
  ui.innerHTML = '';
  const sec = (t) => { const h = document.createElement('h4'); h.textContent = t; ui.appendChild(h); };
  sec('VARIANT'); for (const v of ['orpheus', 'eurydice']) ui.appendChild(btn(v, () => { state.variant = v; load(); }, state.variant === v));
  sec('VIEW'); ui.appendChild(btn('orbit', () => { state.view = 'orbit'; buildUI(); }, state.view === 'orbit')); ui.appendChild(btn('fly', () => { state.view = 'fly'; buildUI(); }, state.view === 'fly'));
  sec('EXTERIOR'); for (const k of Object.keys(EXT_VIEWS)) ui.appendChild(btn(k, () => gotoExt(k)));
  sec('ROOMS'); for (const k of Object.keys(ROOM_CAMS)) ui.appendChild(btn(k, () => gotoRoom(k)));
  sec('STATE');
  ui.appendChild(btn('landed', () => { state.landed = !state.landed; ship.setLanded(state.landed); buildUI(); }, state.landed));
  ui.appendChild(btn('ramp', () => { state.ramp = !state.ramp; ship.setRamp(state.ramp); buildUI(); }, state.ramp));
  ui.appendChild(btn('hide hull', () => { state.hide = !state.hide; applyHide(); buildUI(); }, state.hide));
  ui.appendChild(btn('hide interior', () => { state.hideInt = !state.hideInt; applyHide(); buildUI(); }, state.hideInt));
  ui.appendChild(btn('post', () => { state.post = !state.post; buildUI(); }, state.post));
  ui.appendChild(btn('live', () => { state.live = !state.live; buildUI(); }, state.live));
  sec('LIGHTS'); for (const m of ['normal', 'alert', 'emergency', 'off']) ui.appendChild(btn(m, () => { state.mode = m; ship.interiorLights(m); buildUI(); }, (state.mode || (state.variant === 'eurydice' ? 'emergency' : 'normal')) === m));
  const slider = (label, min, max, step, get, set) => { const l = document.createElement('label'); l.textContent = label + ' '; const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = get(); i.oninput = () => { set(+i.value); dirty = true; }; l.appendChild(i); ui.appendChild(l); };
  sec('PARAMS');
  slider('thrust', 0, 1, 0.01, () => state.thrust, (v) => { state.thrust = v; ship.setThrust(state.thrust, state.boost); });
  slider('boost ', 0, 1, 0.01, () => state.boost, (v) => { state.boost = v; ship.setThrust(state.thrust, state.boost); });
  slider('key   ', 0, 8, 0.1, () => state.key, (v) => { state.key = v; setKeyDir(); });
  slider('az    ', -180, 180, 1, () => state.az, (v) => { state.az = v; setKeyDir(); });
  slider('el    ', -10, 90, 1, () => state.el, (v) => { state.el = v; setKeyDir(); });
  slider('exp   ', 0.1, 8, 0.05, () => state.exp, (v) => { state.exp = v; });
  slider('fov   ', 30, 110, 1, () => fly.fov, (v) => { fly.fov = v; });
}

// ───────── input ─────────
const keys = new Set(); let drag = null;
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyF') { state.live = !state.live; } });
addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, shift: e.shiftKey }; if (state.view === 'fly' && e.button === 0 && !document.pointerLockElement) { /* drag-look (no pointer lock needed in headless) */ } });
addEventListener('mouseup', () => { drag = null; });
addEventListener('mousemove', (e) => {
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (state.view === 'orbit') { if (drag.shift) { const s = orbit.dist * 0.0015; orbit.target.y += dy * s; orbit.target.z += dx * s; } else { orbit.az -= dx * 0.4; orbit.el = Math.max(-89, Math.min(89, orbit.el + dy * 0.4)); } }
  else { fly.yaw -= dx * 0.004; fly.pitch = Math.max(-1.5, Math.min(1.5, fly.pitch - dy * 0.004)); }
  dirty = true;
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (state.view === 'orbit') orbit.dist = Math.max(4, Math.min(400, orbit.dist * Math.exp(e.deltaY * 0.001))); else fly.fov = Math.max(25, Math.min(110, fly.fov + e.deltaY * 0.03)); dirty = true; }, { passive: false });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); dirty = true; });

// ───────── loop ─────────
let last = performance.now(), simT = 0;
const feet = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state.view === 'fly') {
    const sp = (keys.has('ShiftLeft') ? 8 : 2.5) * dt, fw = new THREE.Vector3(-Math.sin(fly.yaw), 0, -Math.cos(fly.yaw)), rt = new THREE.Vector3(Math.cos(fly.yaw), 0, -Math.sin(fly.yaw));
    let mv = false;
    if (keys.has('KeyW')) { fly.pos.addScaledVector(fw, sp); mv = true; } if (keys.has('KeyS')) { fly.pos.addScaledVector(fw, -sp); mv = true; }
    if (keys.has('KeyD')) { fly.pos.addScaledVector(rt, sp); mv = true; } if (keys.has('KeyA')) { fly.pos.addScaledVector(rt, -sp); mv = true; }
    if (keys.has('KeyE')) { fly.pos.y += sp; mv = true; } if (keys.has('KeyQ')) { fly.pos.y -= sp; mv = true; }
    if (mv) dirty = true;
  }
  if (!(dirty || state.live)) return;
  dirty = false;
  simT += state.live ? dt : 0.016;
  applyCam();
  feet.copy(camera.position); feet.y -= 1.66;
  if (ship) ship.update(state.live ? dt : 0.016, simT, state.view === 'fly' ? feet : null);
  lens.uniforms.uExposure.value = state.exp; view.exposure = 1;
  renderer.info.reset();
  if (state.post) composer.render(); else renderer.render(scene, camera);
  const inf = renderer.info.render;
  $('#stat').textContent = `${state.variant}  calls ${inf.calls}  tris ${(inf.triangles / 1000).toFixed(0)}k  build ${buildMs.toFixed(0)} ms` + (ship && ship.errors.length ? '\nERR ' + ship.errors.join(' | ') : '');
}
window.__ship = { buildMs: () => buildMs, info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geoms: renderer.info.memory.geometries, tex: renderer.info.memory.textures }), THREE, scene, camera, renderer, ctx, state, setFly, setOrbit, gotoRoom, gotoExt, render: () => { dirty = true; }, load, ROOM_CAMS, EXT_VIEWS, key, composer };
if (Q.get('cam')) { const c = Q.get('cam').split(',').map(Number); c.length >= 6 ? setFly(c[0], c[1], c[2], c[3], c[4], c[5], c[6] || 70) : null; }
else if (Q.get('room')) gotoRoom(Q.get('room'));
else if (Q.get('ext')) gotoExt(Q.get('ext'));
else if (state.view === 'fly') gotoRoom('cockpit');
else setOrbit(-35, 18, 85);
load().then(() => requestAnimationFrame(frame));
