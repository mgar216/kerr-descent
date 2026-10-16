// HALCYON harness — views the station exterior (orbit camera), the crew, and walks / flies the interior with a fake `ctx`.
//   dev/halcyon.html?mode=ext&view=lit|dark|hub|dock|ring|dish|top|blister|aft|nose&exp=1   (or az/el/dist/tx/ty/tz)
//   dev/halcyon.html?mode=int&room=tube|concourse|ops|pit|lounge|lab|corridor|memorial&post=1&fly=1   (WASD + drag look, E = use, F = fly)
//   dev/halcyon.html?mode=crew&az=180&dist=5      (the four named crew side by side)
// post=0 skips bloom/lens (faster); w/h set the canvas size. Automation handle: window.__h
//   (setView, teleport(x,feetY,z,yaw,pitch), render(n), use(id), pick(i), interactables(), state(), orbit, player, space, ctx)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) ? parseFloat(Q.get(k)) : d);
const MODE = Q.get('mode') || 'ext';
const W = num('w', innerWidth), Hh = num('h', innerHeight);
const POST = Q.get('post') !== '0';
const $ = (id) => document.getElementById(id);
let dirty = true;

// ───────────── renderer / composer (mirrors core: HDR target → bloom → lens tone-map → sRGB) ─────────────
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setPixelRatio(1);
renderer.setSize(W, Hh, false);
canvas.style.width = W + 'px'; canvas.style.height = Hh + 'px';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(num('fov', 70), W / Hh, 0.05, 3e6);
const hemi = new THREE.HemisphereLight(0x9adfff, 0x0b0d12, 0.04);
const sun = new THREE.DirectionalLight(0xffd7b0, num('sun', MODE === 'ext' ? 3.4 : 0));
scene.add(hemi, sun, sun.target);

const LENS = `
uniform sampler2D tDiffuse; uniform float uExposure; varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(L), c, 1.08);
  float Lh = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
  float Lt = Lh*(1.0 + Lh/36.0)/(1.0 + Lh);
  vec3 hp = c*(Lt/Lh);
  hp = mix(hp, vec3(Lt), smoothstep(1.5, 12.0, Lh)*0.7);
  c = mix(aces(c), min(hp, vec3(1.0)), 0.5);
  c = pow(c, vec3(1.0, 1.0, 0.98)) * vec3(1.0, 1.0, 1.02);
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}`;
let composer = null, lens = null;
if (POST) {
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(1); composer.setSize(W, Hh);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, Hh), 0.045, 0.5, 0.0));
  lens = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uExposure: { value: num('exp', 1) } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }', fragmentShader: LENS });
  composer.addPass(lens);
  composer.addPass(new OutputPass());
} else {
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = num('exp', 1);
}

// ───────────── backdrop: stars + Erebus (toward −Z in station-local and in ship space) ─────────────
{
  const n = 5000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let s = 1234567;
  const r01 = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) {
    const z = r01() * 2 - 1, a = r01() * Math.PI * 2, rr = Math.sqrt(1 - z * z), R = 1.5e6;
    pos.set([rr * Math.cos(a) * R, z * R, rr * Math.sin(a) * R], i * 3);
    const b = Math.pow(r01(), 3) * 1.6 + 0.2, t = r01();
    col.set([b * (0.8 + 0.4 * t), b * 0.9, b * (1.2 - 0.4 * t)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, toneMapped: false, depthWrite: false }));
  stars.frustumCulled = false; stars.renderOrder = -10;
  scene.add(stars);

  // Erebus: a lensed accretion-disk billboard
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  const glow = x.createRadialGradient(S / 2, S / 2, S * 0.09, S / 2, S / 2, S * 0.5);
  glow.addColorStop(0, 'rgba(255,170,70,0.0)'); glow.addColorStop(0.35, 'rgba(255,150,50,0.28)'); glow.addColorStop(1, 'rgba(255,100,20,0)');
  x.fillStyle = glow; x.fillRect(0, 0, S, S);
  x.save(); x.translate(S / 2, S / 2);
  for (let k = 0; k < 26; k++) { // flat disk
    const f = k / 25;
    x.strokeStyle = `rgba(255,${(150 + 90 * (1 - f)) | 0},${(60 + 120 * (1 - f)) | 0},${0.06 + 0.1 * (1 - f)})`; x.lineWidth = 7 + 4 * f;
    x.beginPath(); x.ellipse(0, 0, S * (0.2 + 0.26 * f), S * (0.035 + 0.04 * f), 0, 0, Math.PI * 2); x.stroke();
  }
  for (let k = 0; k < 22; k++) { // lensed arcs over/under
    const f = k / 21;
    x.strokeStyle = `rgba(255,${(170 + 70 * (1 - f)) | 0},${(80 + 100 * (1 - f)) | 0},${0.1 + 0.12 * (1 - f)})`; x.lineWidth = 6 + 3 * f;
    x.beginPath(); x.arc(0, 0, S * (0.155 + 0.07 * f), 0, Math.PI * 2); x.stroke();
  }
  x.fillStyle = '#000'; x.beginPath(); x.arc(0, 0, S * 0.135, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(255,235,200,0.95)'; x.lineWidth = 7; x.beginPath(); x.arc(0, 0, S * 0.138, 0, Math.PI * 2); x.stroke();
  x.restore();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(2.6, 2.3, 2.0), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  spr.position.set(0, 0, -7e5); spr.scale.set(4.6e5, 4.6e5, 1); spr.renderOrder = -9;
  scene.add(spr);
}
sun.position.set(0, 0, -1e4);

// ───────────── fake ctx ─────────────
let LINES = null;
import('../src/voice/lines.js').then((m) => { LINES = m.LINES || null; }).catch(() => {});
const log = (...a) => console.log('[halcyon]', ...a);
const showCap = (who, text) => { const c = $('cap'); c.style.display = 'block'; c.textContent = (who ? who + ': ' : '') + text; clearTimeout(showCap.t); showCap.t = setTimeout(() => (c.style.display = 'none'), 3200); };
let dlgResolve = null;
const dlg = $('dlg');
const ctx = {
  THREE, renderer, scenes: { near: scene }, cameras: { near: camera }, view: { exposure: 1 },
  settings: {}, K: {}, ship: { tau: 3600 * 7 + 1234 }, obs: {}, sim: { wall: 0 }, MC: {},
  audio: { ui() {} },
  say(id, opts = {}) {
    const ln = LINES && LINES[id];
    log('say', id, opts.priority || '');
    showCap(ln ? ln.who : '', ln ? String(ln.text || '').replace(/\[[^\]]*\]/g, '') : '(' + id + ')');
    setTimeout(() => opts.onEnd && opts.onEnd(), 500);
  },
  sayText(who, text) { showCap(who, text); },
  ui: {
    toast(html) { const t = $('toast'); t.innerHTML = html; t.style.display = 'block'; clearTimeout(ctx.ui.toast.t); ctx.ui.toast.t = setTimeout(() => (t.style.display = 'none'), 5000); log('toast', html.replace(/<[^>]+>/g, '')); },
    cine(a, b) { const c = $('cine'); c.querySelector('.a').textContent = a; c.querySelector('.b').textContent = b; c.style.display = 'block'; setTimeout(() => (c.style.display = 'none'), 4200); log('cine', a, b); },
    prompt(html) { const p = $('prompt'); if (html) { p.innerHTML = html; p.style.display = 'block'; } else p.style.display = 'none'; },
    log() {}, subtitle(who, text) { showCap(who, text); },
    choose(title, options) {
      log('choose', title, options.map((o) => o.label + (o.done ? ' ✓' : '')));
      dlg.querySelector('h3').textContent = title;
      const list = dlg.querySelector('.list'); list.replaceChildren();
      options.forEach((o, i) => {
        const d = document.createElement('div'); d.className = 'opt' + (o.done ? ' done' : '');
        d.innerHTML = `<span class="k">${i + 1}</span>${o.label}${o.sub ? ' <small>' + o.sub + '</small>' : ''}${o.done ? ' ✓' : ''}`;
        d.onclick = () => finish(i); list.appendChild(d);
      });
      dlg.style.display = 'flex';
      return new Promise((res) => { dlgResolve = res; });
    },
    fade() { return Promise.resolve(); },
  },
  bus: { on() {}, off() {}, emit(e, p) { log('bus', e, JSON.stringify(p)); } },
  modes: { set() {}, current: () => 'walk' },
  input: { keys: new Set(), locked: () => false, requestLock() {} },
  flags: { _m: {}, once(k, fn) { if (!this._m[k]) { this._m[k] = 1; fn(); } }, get(k) { return this._m[k]; }, set(k, v) { this._m[k] = v; } },
  codex: { unlock(id) { log('codex.unlock', id); return true; }, isUnlocked: () => false },
  nav: {}, spaces: { enter(id, entry) { log('spaces.enter', id, entry); showCap('', 'spaces.enter(' + id + ', ' + entry + ')'); }, current: () => 'halcyon' },
  fx: {}, units: {},
};
function finish(i) { dlg.style.display = 'none'; const r = dlgResolve; dlgResolve = null; if (r) r(i); }
addEventListener('keydown', (e) => { if (dlgResolve && /^Digit[1-9]$/.test(e.code)) finish(+e.code.slice(5) - 1); if (dlgResolve && e.code === 'Escape') finish(null); });

// ───────────── content ─────────────
const H = await import('../src/world/halcyon.js');
let ex = null, interior = null, space = null;
let crewList = [];
const ORBIT = MODE !== 'int';
if (MODE === 'crew') {
  const { createCrewKit, CREW } = await import('../src/world/halcyon/crew.js');
  const { getGfx } = await import('../src/world/halcyon/gfx.js');
  const G = getGfx(THREE), kit = createCrewKit(THREE, G);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x2a303a, roughness: 0.6 })).rotateX(-Math.PI / 2));
  const key = new THREE.PointLight(0xfff0e0, 70, 30, 2); key.position.set(2, 4, 5); const fill = new THREE.PointLight(0x9ec4ff, 30, 30, 2); fill.position.set(-4, 3, 4);
  scene.add(key, fill); hemi.intensity = 0.25;
  const yaw = (dx, dz) => Math.atan2(dx, dz);
  const put = (spec, x, z, face, o = {}) => { const c = kit.build(spec); c.place(x, 0, z, face); if (o.seat) c.setSeat(kit.chairMesh(), o.seat); if (o.look) c.lookAt = new THREE.Vector3(...o.look); scene.add(c.group); crewList.push(c); return c; };
  put(CREW.jonah, -3, 0, 0, { seat: 0.47, look: [-3, 1.2, 6] });
  put(CREW.fd, -1, 0, 0, { look: [-1, 1.5, 6] }); put(CREW.sci, 1, 0, 0, { look: [1, 1.3, 6] }); put(CREW.mira, 3, 0, 0, { look: [3, 1.5, 6] });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: 0x777b80 })); rail.position.set(-1, 1.1, 0.5); scene.add(rail);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.78, 0.9), new THREE.MeshStandardMaterial({ color: 0x20262e })); desk.position.set(-3, 0.39, 0.8); scene.add(desk);
  hemi.intensity = 0.3;
  window.__crew = crewList;
} else if (MODE === 'ext') {
  ex = H.buildHalcyonExterior(THREE);
  scene.add(ex);
  log('exterior built', ex.userData.dock, 'draw calls ≈', (() => { let n = 0; ex.traverse((o) => { if (o.isMesh || o.isPoints) n++; }); return n; })());
} else {
  interior = H.createHalcyonInterior(ctx);
  scene.add(interior.group); space = interior.space;
  hemi.intensity = num('fill', 0.05);
  log('interior built', space.rooms && space.rooms.map((r) => r.id));
}

// ───────────── cameras ─────────────
const orbit = { az: 25, el: 18, dist: 1900, t: new THREE.Vector3(0, 0, 0) };
const VIEWS = {
  lit: { az: 20, el: 22, dist: 2000, t: [0, 0, 0] },
  dark: { az: 200, el: 15, dist: 1900, t: [0, 0, 0] },
  top: { az: 90, el: 70, dist: 1800, t: [0, 0, 0] },
  hub: { az: 70, el: 25, dist: 330, t: [700, 0, 0] },
  dock: { az: 130, el: 20, dist: 70, t: [702.6, 73.8, 0] },
  dockside: { az: 90, el: 5, dist: 90, t: [702.6, 60, 0] },
  ring: { az: 8, el: 10, dist: 1300, t: [260, 0, 0] },
  dish: { az: 40, el: 14, dist: 260, t: [540, 0, -100] },
  blister: { az: 10, el: 18, dist: 150, t: [700, 0, -55] },
  aft: { az: 150, el: 24, dist: 700, t: [-500, 0, 0] },
  nose: { az: 60, el: 18, dist: 220, t: [780, 0, 0] },
};
function setView(v) {
  const p = typeof v === 'string' ? VIEWS[v] : v; if (!p) return;
  Object.assign(orbit, { az: p.az ?? orbit.az, el: p.el ?? orbit.el, dist: p.dist ?? orbit.dist });
  if (p.t) orbit.t.set(p.t[0], p.t[1], p.t[2]);
  dirty = true;
}
function applyOrbit() {
  const az = orbit.az * Math.PI / 180, el = orbit.el * Math.PI / 180;
  camera.position.set(orbit.t.x + orbit.dist * Math.cos(el) * Math.sin(az), orbit.t.y + orbit.dist * Math.sin(el), orbit.t.z - orbit.dist * Math.cos(el) * Math.cos(az));
  if (orbit.pos) camera.position.set(orbit.pos[0], orbit.pos[1], orbit.pos[2]);
  camera.up.set(orbit.up ? orbit.up[0] : 0, orbit.up ? orbit.up[1] : 1, orbit.up ? orbit.up[2] : 0); camera.lookAt(orbit.t);
}

// interior walker
const player = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, vy: 0, fly: Q.get('fly') === '1', speed: 3.2 };
const ROOMS = {
  tube: [-9, -1.2, 16, Math.PI / 2], concourse: [-20, -1.2, 16, Math.PI / 2], ops: [-52, -1.2, 16, Math.PI / 2], pit: [-66, -1.6, 16, Math.PI / 2],
  lounge: [-76, -1.2, -12, 0], lab: [-76, -1.2, 44, 0], corridor: [-32, -1.2, 30, 0], memorial: [-90, -1.2, -24, Math.PI / 2],
};
function teleport(x, y, z, yaw = 0, pitch = 0) { player.pos.set(x, y, z); player.yaw = yaw; player.pitch = pitch; player.vy = 0; dirty = true; }
if (MODE === 'int') {
  const sp = space.spawn;
  const R = Q.get('room');
  if (Q.has('pos')) { const [x, y, z] = Q.get('pos').split(',').map(Number); teleport(x, y, z, num('yaw', 0) * Math.PI / 180, num('pitch', 0) * Math.PI / 180); }
  else if (R && ROOMS[R]) { const r = ROOMS[R]; teleport(r[0], r[1], r[2], Q.has('yaw') ? num('yaw', 0) * Math.PI / 180 : r[3], num('pitch', 0) * Math.PI / 180); }
  else teleport(sp.pos[0], sp.pos[1], sp.pos[2], sp.yaw, 0);
}
function applyWalker() {
  camera.position.set(player.pos.x, player.pos.y + 1.66, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
}

// ───────────── input ─────────────
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code); dirty = true;
  if (MODE === 'int' && e.code === 'KeyE' && !dlgResolve) useNearest();
  if (e.code === 'KeyF') player.fly = !player.fly;
});
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => (drag = null));
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; dirty = true;
  if (ORBIT) { orbit.az -= dx * 0.4; orbit.el = Math.max(-89, Math.min(89, orbit.el + dy * 0.3)); }
  else { player.yaw -= dx * 0.004; player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * 0.004)); }
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist *= Math.exp(e.deltaY * 0.001); dirty = true; }, { passive: false });

function nearestInteractable() {
  if (!space) return null;
  const eye = camera.position, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  let best = null, bd = 1e9;
  for (const it of space.interactables) {
    if (it.enabled && !it.enabled()) continue;
    const d = it.pos.distanceTo(eye);
    if (d > 2.2 + it.radius) continue;
    const to = it.pos.clone().sub(eye).normalize();
    const ang = Math.acos(Math.max(-1, Math.min(1, to.dot(fwd))));
    const score = d + ang * 2;
    if (ang < 1.0 && score < bd) { bd = score; best = it; }
  }
  return best;
}
function useNearest() { const it = nearestInteractable(); if (it) it.use(); }

// ───────────── loop ─────────────
let last = performance.now(), t = 0;
const ANIM = Q.get('anim') === '1';
function step(dt) {
  t += dt;
  if (ORBIT) {
    if (ex) ex.userData.update(dt, t + num('t0', 0));
    for (const c of crewList) c.update(dt, t, camera.position);
    const sp = 400 * dt * (keys.has('ShiftLeft') ? 4 : 1);
    if (keys.has('KeyA')) orbit.az -= 40 * dt; if (keys.has('KeyD')) orbit.az += 40 * dt;
    if (keys.has('KeyW')) orbit.dist *= Math.exp(-dt); if (keys.has('KeyS')) orbit.dist *= Math.exp(dt);
    void sp;
    applyOrbit();
  } else {
    const run = keys.has('ShiftLeft') ? 2.2 : 1;
    const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    if (keys.has('ArrowLeft')) player.yaw += 1.6 * dt; if (keys.has('ArrowRight')) player.yaw -= 1.6 * dt;
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const vx = (-sy * f + cy * s) * player.speed * run * dt, vz = (-cy * f - sy * s) * player.speed * run * dt;
    if (player.fly) {
      const fl = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      player.pos.addScaledVector(fl, f * player.speed * 3 * run * dt);
      player.pos.x += cy * s * player.speed * 3 * run * dt; player.pos.z -= sy * s * player.speed * 3 * run * dt;
    } else {
      player.pos.x += vx; player.pos.z += vz;
      space.collide(player.pos, 0.32, 1.8);
      const fl = space.floorAt(player.pos.x, player.pos.z, player.pos.y);
      if (fl == null) { player.pos.x -= vx; player.pos.z -= vz; }
      else { player.vy -= 9.81 * dt; player.pos.y += player.vy * dt; if (player.pos.y <= fl) { player.pos.y = fl; player.vy = 0; } else if (fl > player.pos.y - 0.45 && player.vy >= 0) player.pos.y = fl; }
    }
    applyWalker();
    interior.update(dt);
    const it = nearestInteractable();
    ctx.ui.prompt(it ? '[E] ' + (typeof it.label === 'function' ? it.label() : it.label) : null);
  }
}
function render() {
  if (ORBIT) applyOrbit(); else applyWalker();
  if (composer) composer.render(); else renderer.render(scene, camera);
  const p = camera.position;
  $('hud').textContent = `${MODE}  cam ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  ` + (ORBIT ? `az ${orbit.az.toFixed(0)} el ${orbit.el.toFixed(0)} dist ${orbit.dist.toFixed(1)}` : `yaw ${(player.yaw * 57.3).toFixed(0)} pitch ${(player.pitch * 57.3).toFixed(0)}`) + `  calls ${renderer.info.render.calls} tris ${renderer.info.render.triangles}`;
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (dirty || ANIM || keys.size) { step(dt); render(); dirty = false; }
  requestAnimationFrame(frame);
}
if (MODE === 'crew') { setView({ az: num('az', 0), el: num('el', 6), dist: num('dist', 6), t: [num('tx', 0), num('ty', 1.0), num('tz', 0)] }); }
if (MODE === 'ext') { if (Q.get('view')) setView(Q.get('view')); else setView({ az: num('az', 25), el: num('el', 18), dist: num('dist', 1900) }); if (Q.has('tx')) orbit.t.set(num('tx', 0), num('ty', 0), num('tz', 0)); if (Q.has('az')) orbit.az = num('az', 0); if (Q.has('el')) orbit.el = num('el', 0); if (Q.has('dist')) orbit.dist = num('dist', 0); }
requestAnimationFrame(frame);

window.__h = {
  THREE, ctx, scene, camera, renderer, ex, interior, space, player, orbit, VIEWS,
  setView, teleport, render: (n = 10) => { dirty = false; for (let i = 0; i < n; i++) step(0.1); render(); },
  use: (id) => { const it = space.interactables.find((i) => i.id === id); return it && it.use(); },
  pick: (i) => finish(i),
  interactables: () => space && space.interactables.map((i) => i.id),
  at: (t0) => { t = t0; if (ex) ex.userData.update(0, t0); dirty = true; },
  state: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
};
