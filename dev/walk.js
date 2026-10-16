// Harness for src/ship/walk.js (walk + EVA modes) and src/audio/foley.js — fake ctx, test deck, foley lab, self tests.
//   http://localhost:5173/dev/walk.html            interactive (click to capture the mouse; WASD / Shift / Space / Ctrl / E / F)
//   …/walk.html?test=1                              runs the physics / interaction / EVA self tests on load
//   …/walk.html?clean=1                             hides the DOM panels (for screenshots)
import * as THREE from 'three';
import { makeBoxSpace, createWalkMode, createEvaMode } from '../src/ship/walk.js';
import { createFoley, MATERIALS } from '../src/audio/foley.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const V3 = THREE.Vector3;
if (qs.get('clean')) document.body.classList.add('clean');

// ───────────────────────────────────────────── log + ui mocks ─────────────────────────────────────────────
const logEl = $('log');
function log(kind, tag, text) {
  const d = document.createElement('div');
  d.className = 'l';
  d.innerHTML = `<${kind}>${tag}</${kind}> ${text}`;
  logEl.appendChild(d);
  while (logEl.children.length > 14) logEl.removeChild(logEl.firstChild);
  console.log(`[${tag}] ${String(text).replace(/<[^>]+>/g, '')}`);
}
const ui = {
  prompt(html) { $('hint').innerHTML = html || ''; },
  toast(html) { log('i', 'TOAST', html); },
  subtitle(who, text, ms) { $('sub').textContent = `${who}: ${text}`; clearTimeout(ui._t); ui._t = setTimeout(() => { $('sub').textContent = ''; }, ms || 3000); },
  log(cls, who, text) { log('u', who, text); },
};

// ───────────────────────────────────────────── audio (AudioEngine-like) ─────────────────────────────────────────────
function impulse(c, dur, decay) {
  const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n; lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - t, decay) * (i < 90 ? i / 90 : 1); } }
  return b;
}
function makeAudio(c) {
  const G = (v, dst) => { const g = c.createGain(); g.gain.value = v; if (dst) g.connect(dst); return g; };
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.25;
  const master = G(0.85); master.connect(comp); comp.connect(c.destination);
  const sfx = G(1, master), verb = c.createConvolver();
  verb.buffer = impulse(c, 3.2, 2.4);
  const verbIn = G(1); verbIn.connect(verb); verb.connect(G(0.42, master));
  return { ctx: c, ready: true, master, sfx, verbIn, radio: G(0.9, master), musicBus: G(0, master) };
}
const audio = { ctx: null, ready: false, sfx: null, verbIn: null, master: null };
function initAudio() {
  if (audio.ctx) { if (audio.ctx.state !== 'running') audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  Object.assign(audio, makeAudio(new AC({ latencyHint: 'interactive' })));
  $('audState').textContent = 'AUDIO ' + audio.ctx.state.toUpperCase();
  audio.ctx.onstatechange = () => { $('audState').textContent = 'AUDIO ' + audio.ctx.state.toUpperCase(); };
}
initAudio();
addEventListener('pointerdown', initAudio);
addEventListener('keydown', initAudio, { once: true });

// ───────────────────────────────────────────── renderer / ctx ─────────────────────────────────────────────
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.03, 6000);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const keys = new Set();
const busMap = new Map();
const bus = {
  on(e, f) { (busMap.get(e) || busMap.set(e, []).get(e)).push(f); },
  off(e, f) { const l = busMap.get(e); if (l) { const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); } },
  emit(e, p) { if (e === 'room') log('i', 'ROOM', `${p.space} → <b>${p.room}</b>`); else if (e === 'interact') log('b', 'INTERACT', p.id); (busMap.get(e) || []).forEach((f) => f(p)); },
};
const onceDone = new Set();
const flags = { once(k, fn) { if (!onceDone.has(k)) { onceDone.add(k); fn(); } }, get: (k) => onceDone.has(k), set: (k) => onceDone.add(k) };
const modeReg = {};
let curMode = 'none';
const modes = {
  set(name, opts) {
    const prev = modeReg[curMode], next = modeReg[name];
    if (!next) { console.error('unknown mode', name); return; }
    const from = curMode;
    if (prev && prev.exit) prev.exit(name);
    curMode = name;
    next.enter(opts || {});
    bus.emit('mode', { from, to: name });
    log('u', 'MODE', `${from} → ${name}`);
  },
  current: () => curMode,
};
const sayLog = [];
const ctx = {
  THREE, renderer, scenes: { near: scene }, cameras: { near: camera }, view: { exposure: 1 },
  settings: { sens: 1, invertY: false, fov: 75, hud: true },
  audio, ui, bus, modes, flags, fx: { shake: 0, flash: 0 },
  input: { keys, locked: () => document.pointerLockElement === canvas, requestLock: () => { try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* headless: no pointer lock */ } } },
  say(id, o) { sayLog.push(id); log('b', 'SAY', id); },
  sayText(who, t) { log('b', 'SAY', `${who}: ${t}`); },
  mcReact() {},
  spaces: { enter() {}, current: () => level.space },
  shipModel: null,
};
const foley = createFoley(ctx);

// ───────────────────────────────────────────── procedural textures / materials ─────────────────────────────────────────────
function mkTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function speckle(g, w, h, n, a) { for (let i = 0; i < n; i++) { const v = Math.random() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},${a * Math.random()})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
const TEX = {
  wall: mkTex(512, 512, (g, w, h) => { // ceramic panel, 1 m tile
    g.fillStyle = '#c3c9cf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#cdd2d8'; g.fillRect(10, 10, w - 20, h - 20);
    g.strokeStyle = 'rgba(40,48,58,.85)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; g.strokeRect(12, 12, w - 24, h - 24);
    g.strokeStyle = 'rgba(40,48,58,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(w / 2, 12); g.lineTo(w / 2, h - 12); g.stroke();
    g.fillStyle = 'rgba(30,36,44,.8)'; for (const [x, y] of [[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]]) { g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); }
    speckle(g, w, h, 1400, 0.06);
  }),
  floor: mkTex(512, 512, (g, w, h) => { // dark plating with diamond tread
    g.fillStyle = '#434b56'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(10,12,16,.9)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(160,175,190,.10)'; g.lineWidth = 2;
    for (let i = -h; i < w + h; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1.5; g.strokeRect(14, 14, w - 28, h - 28);
    speckle(g, w, h, 1600, 0.10);
  }),
  grate: mkTex(256, 256, (g, w, h) => {
    g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a5560'; for (let i = 0; i < w; i += 16) g.fillRect(i, 0, 5, h);
    g.fillStyle = '#39424c'; for (let j = 0; j < h; j += 64) g.fillRect(0, j, w, 6);
  }),
  ceil: mkTex(512, 512, (g, w, h) => {
    g.fillStyle = '#9aa2aa'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(20,26,34,.8)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.strokeRect(16, 16, w - 32, h - 32); speckle(g, w, h, 900, 0.07);
  }),
  hull: mkTex(512, 512, (g, w, h) => {
    g.fillStyle = '#e1e5e8'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(70,80,92,.9)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.strokeStyle = 'rgba(80,90,100,.35)'; g.lineWidth = 1.5; g.strokeRect(24, 24, w - 48, h - 48);
    g.fillStyle = 'rgba(60,70,80,.7)'; for (let i = 0; i < 8; i++) { g.fillRect(40 + i * 56, 8, 3, 3); g.fillRect(40 + i * 56, h - 11, 3, 3); }
    speckle(g, w, h, 900, 0.08);
  }),
  hazard: mkTex(256, 64, (g, w, h) => {
    g.fillStyle = '#16181c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0a020';
    for (let i = -h; i < w + h; i += 40) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + 20, h); g.lineTo(i + 20 + h, 0); g.lineTo(i + h, 0); g.fill(); }
  }),
  stars: mkTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const rg = g.createRadialGradient(w * 0.72, h * 0.55, 0, w * 0.72, h * 0.55, h * 0.9); rg.addColorStop(0, 'rgba(255,170,90,.95)'); rg.addColorStop(0.15, 'rgba(255,120,40,.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 150 + Math.random() * 105 | 0; g.fillStyle = `rgb(${v},${v},${Math.min(255, v + 20)})`; const s = Math.random() < 0.06 ? 2 : 1; g.fillRect(Math.random() * w, Math.random() * h, s, s); }
  }, false),
};
const M = {
  wall: new THREE.MeshStandardMaterial({ map: TEX.wall, roughness: 0.62, metalness: 0.08 }),
  floor: new THREE.MeshStandardMaterial({ map: TEX.floor, roughness: 0.6, metalness: 0.12 }),
  grate: new THREE.MeshStandardMaterial({ map: TEX.grate, roughness: 0.6, metalness: 0.25 }),
  ceil: new THREE.MeshStandardMaterial({ map: TEX.ceil, roughness: 0.8, metalness: 0.05 }),
  hull: new THREE.MeshStandardMaterial({ map: TEX.hull, roughness: 0.5, metalness: 0.08 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x3b4551, roughness: 0.5, metalness: 0.2 }),
  carbon: new THREE.MeshStandardMaterial({ color: 0x1b2129, roughness: 0.4, metalness: 0.25 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xd8651c, roughness: 0.5, metalness: 0.3 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.85, metalness: 0.05 }),
  hazard: new THREE.MeshStandardMaterial({ map: TEX.hazard, roughness: 0.6, metalness: 0.2 }),
  lightStrip: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 2.2), toneMapped: false }),
  cyan: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 1.8), toneMapped: false }),
  amber: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.1, 0.25), toneMapped: false }),
  stars: new THREE.MeshBasicMaterial({ map: TEX.stars, toneMapped: false }),
};

function screenTex(title, hue) {
  return mkTex(512, 320, (g, w, h) => {
    g.fillStyle = '#031018'; g.fillRect(0, 0, w, h);
    g.strokeStyle = `hsla(${hue},90%,70%,.25)`; g.lineWidth = 1;
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = `hsl(${hue},90%,68%)`; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16);
    g.beginPath(); g.arc(w * 0.5, h * 0.55, 80, 0, 7); g.stroke(); g.beginPath(); g.arc(w * 0.5, h * 0.55, 46, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(40, h * 0.8); for (let x = 40; x < w - 40; x += 8) g.lineTo(x, h * 0.8 - 18 * Math.sin(x * 0.04) * Math.sin(x * 0.011)); g.stroke();
    g.fillStyle = `hsl(${hue},90%,75%)`; g.font = '700 26px Orbitron, Consolas, monospace'; g.fillText(title, 24, 46);
    g.font = '16px "Share Tech Mono", Consolas, monospace'; g.fillText('STATUS NOMINAL', 24, 72); g.fillText('T+00:04:12', w - 140, 46);
  }, false);
}
const screenMats = [screenTex('NAV', 190), screenTex('SYS', 140), screenTex('ENG', 30)].map((t) => new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));

// ───────────────────────────────────────────── geometry helpers ─────────────────────────────────────────────
function worldUV(geo, c, tile) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + c[0], y = p.getY(i) + c[1], z = p.getZ(i) + c[2], ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ax > 0.5) uv.setXY(i, z / tile, y / tile); else if (ay > 0.5) uv.setXY(i, x / tile, z / tile); else uv.setXY(i, x / tile, y / tile);
  }
}
function boxMesh(x0, y0, z0, x1, y1, z1, mat, tile = 1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  worldUV(g, c, tile);
  const m = new THREE.Mesh(g, mat); m.position.set(c[0], c[1], c[2]);
  return m;
}

// ───────────────────────────────────────────── the test deck ─────────────────────────────────────────────
const DECK = -1.2, CEIL = 1.4, HIGH = 2.6, PLAT = -0.2;
const level = buildLevel();
scene.add(level.group, level.exterior);

function buildLevel() {
  const group = new THREE.Group(), colliders = [], floors = [], interactables = [], rooms = [], lights = [];
  const add = (mesh) => { group.add(mesh); return mesh; };
  // solid box: visual + collider
  const solid = (x0, y0, z0, x1, y1, z1, mat, extra = {}, tile = 1) => { add(boxMesh(x0, y0, z0, x1, y1, z1, mat, tile)); colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1], ...extra }); };
  const col = (x0, y0, z0, x1, y1, z1, extra = {}) => colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1], ...extra }); // collider only
  const wall = (x0, z0, x1, z1, top = CEIL, extra = {}) => solid(x0, DECK, z0, x1, top, z1, M.wall, extra);
  const vis = (x0, y0, z0, x1, y1, z1, mat, tile = 1) => add(boxMesh(x0, y0, z0, x1, y1, z1, mat, tile));
  const light = (x, y, z, i, dist, col = 0xe6f0ff) => { const l = new THREE.PointLight(col, i, dist, 2); l.position.set(x, y, z); group.add(l); lights.push([l, i]); return l; };
  const hemi = new THREE.HemisphereLight(0x8fb0d0, 0x202428, 0.35); group.add(hemi); lights.push([hemi, 0.35]);

  // ── flight deck x[-3,3] z[-4,2.4]
  col(-3.2, DECK, -4.2, 3.2, CEIL, -4.0);                       // front wall collider; visual has a canopy window
  vis(-3.2, DECK, -4.2, 3.2, -0.15, -4.0, M.wall); vis(-3.2, 1.05, -4.2, 3.2, CEIL, -4.0, M.wall);
  vis(-3.2, -0.15, -4.2, -2.4, 1.05, -4.0, M.wall); vis(2.4, -0.15, -4.2, 3.2, 1.05, -4.0, M.wall);
  const canopy = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2), M.stars); canopy.position.set(0, 0.45, -4.12); group.add(canopy);
  vis(-2.45, -0.2, -4.12, 2.45, -0.15, -3.95, M.carbon); vis(-2.45, 1.05, -4.12, 2.45, 1.1, -3.95, M.carbon);
  wall(-3.2, -4.0, -3.0, 2.6); wall(3.0, -4.0, 3.2, 2.6);
  wall(-3.0, 2.4, -1.1, 2.6); wall(1.1, 2.4, 3.0, 2.6);
  floors.push({ min: [-3, -4], max: [3, 2.4], y: DECK });
  vis(-3, DECK - 0.2, -4, 3, DECK, 2.4, M.floor);
  solid(-3, CEIL, -4, 3, CEIL + 0.2, 2.4, M.ceil, {}, 1);
  // dash console + screens
  solid(-2.6, DECK, -3.7, 2.6, -0.55, -2.8, M.dark);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 0.9), M.carbon); dash.position.set(0, -0.5, -3.2); dash.rotation.x = -0.28; group.add(dash);
  const scr = [-1.55, 0, 1.55].map((x, i) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), screenMats[i]); s.position.set(x, -0.28, -3.55); s.rotation.x = -0.28; group.add(s); return s; });
  vis(-2.62, -0.56, -3.72, 2.62, -0.5, -2.78, M.orange);
  // pilot seat (eye at origin), systems seat
  const seat = new THREE.Group(); seat.position.set(0, 0, 0.05);
  const sb = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); seat.add(b); };
  sb(0.62, 0.16, 0.6, 0, -0.6, 0.1, M.seat); sb(0.62, 0.78, 0.14, 0, -0.16, 0.42, M.seat); sb(0.34, 0.26, 0.12, 0, 0.36, 0.44, M.seat);
  sb(0.1, 0.1, 0.5, -0.38, -0.42, 0.14, M.carbon); sb(0.1, 0.1, 0.5, 0.38, -0.42, 0.14, M.carbon); sb(0.3, 0.55, 0.3, 0, -0.95, 0.15, M.dark);
  sb(0.64, 0.02, 0.02, 0, -0.52, -0.2, M.orange);
  group.add(seat);
  col(-0.4, DECK, -0.25, 0.4, -0.45, 0.6);
  const seat2 = seat.clone(); seat2.position.set(1.4, 0, 1.25); group.add(seat2);
  col(1.05, DECK, 0.95, 1.75, -0.45, 1.6);
  const mkStrip = (x, y, z, w, d, m) => vis(x - w / 2, y - 0.02, z - d / 2, x + w / 2, y + 0.02, z + d / 2, m);
  [-1.8, 0, 1.8].forEach((x) => mkStrip(x, CEIL - 0.01, -1.2, 0.5, 4.2, M.lightStrip));
  mkStrip(-2.98, -0.9, -1, 0.04, 4, M.cyan); mkStrip(2.98, -0.9, -1, 0.04, 4, M.amber);
  light(0, 1.0, -1.2, 9, 11); light(0, 1.0, 1.4, 4, 7);
  rooms.push({ id: 'flightdeck', name: 'FLIGHT DECK', min: [-3, DECK, -4], max: [3, CEIL, 2.4] });

  // ── corridor x[-1.1,1.1] z[2.4,24]; ceiling steps up at z=12
  wall(-1.3, 2.6, -1.1, 9.0); wall(-1.3, 12.0, -1.1, 20.0, HIGH);
  wall(1.1, 2.6, 1.3, 12.0); wall(1.1, 12.0, 1.3, 20.0, HIGH);
  floors.push({ min: [-1.1, 2.4], max: [1.1, 12], y: DECK });
  floors.push({ min: [-1.1, 12], max: [1.1, 16], y0: DECK, y1: PLAT, axis: 'z' });          // ramp
  floors.push({ min: [-1.1, 16], max: [1.1, 20], y: PLAT });                                 // raised dome deck
  vis(-1.1, DECK - 0.2, 2.4, 1.1, DECK, 12, M.floor);
  vis(-1.1, PLAT - 0.2, 16, 1.1, PLAT, 20, M.floor);
  { // ramp surface
    const g = new THREE.BufferGeometry(), v = [-1.1, DECK, 12, 1.1, DECK, 12, 1.1, PLAT, 16, -1.1, PLAT, 16];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2.2, 0, 2.2, 4.1, 0, 4.1], 2));
    g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals(); add(new THREE.Mesh(g, M.floor));
    for (let i = 0; i < 8; i++) { const t = (i + 0.5) / 8; vis(-1.0, DECK + (PLAT - DECK) * t + 0.005, 12 + 4 * t - 0.03, 1.0, DECK + (PLAT - DECK) * t + 0.014, 12 + 4 * t + 0.03, M.carbon); }
  }
  // (flight-deck ceiling slab is added in the flight-deck section)
  solid(-1.1, CEIL, 2.4, 1.1, CEIL + 0.2, 12, M.ceil);
  solid(-1.1, HIGH, 12, 1.1, HIGH + 0.2, 24, M.ceil);
  vis(-1.1, CEIL, 11.9, 1.1, HIGH, 12.1, M.carbon);
  [4.5, 7.0, 10.0].forEach((z) => mkStrip(0, CEIL - 0.01, z, 0.5, 0.9, M.lightStrip));
  [14.5, 18.0, 21.5].forEach((z) => mkStrip(0, HIGH - 0.01, z, 0.6, 1.2, M.lightStrip));
  [-1.095, 1.095].forEach((x, i) => { vis(x - 0.01, -0.95, 2.6, x + 0.01, -0.9, 12, i ? M.amber : M.cyan); });
  light(0, 1.05, 5.4, 6, 9); light(0, 1.05, 9.6, 5, 8); light(0, 2.3, 15.8, 8, 12); light(0, 2.3, 18.8, 7, 10);
  rooms.push({ id: 'corridor', name: 'CORRIDOR', min: [-1.1, DECK, 2.4], max: [1.1, CEIL, 12] });
  rooms.push({ id: 'dome', name: 'DOME DECK', min: [-1.1, DECK, 12], max: [1.1, HIGH, 20] });

  // door D1 (z=8): collider enabled while not (nearly) fully open; two sliding panels
  const D1 = { t: 0, open: false };
  colliders.push({ min: [-1.1, DECK, 7.9], max: [1.1, CEIL, 8.1], enabled: () => D1.t < 0.9 });
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(1.1, CEIL - DECK, 0.16), M.dark), doorR = doorL.clone();
  doorL.position.set(-0.55, (CEIL + DECK) / 2, 8); doorR.position.set(0.55, (CEIL + DECK) / 2, 8); group.add(doorL, doorR);
  const dh = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 0.2), M.hazard); dh.position.set(0, CEIL - 0.07, 8); group.add(dh);
  const dp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.04), M.carbon); dp.position.set(1.04, -0.1, 7.55); group.add(dp);
  const dpl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), M.cyan); dpl.position.set(1.04, -0.02, 7.575); dpl.rotation.y = Math.PI; group.add(dpl);

  // ── lab nook (port alcove) x[-3.3,-1.1] z[9,12], grate floor
  wall(-3.5, 8.8, -1.3, 9.0); wall(-3.5, 12.0, -1.3, 12.2); wall(-3.5, 9.0, -3.3, 12.0);
  floors.push({ min: [-3.3, 9], max: [-1.1, 12], y: DECK, mat: 'grate' });
  add(boxMesh(-3.3, DECK - 0.2, 9, -1.1, DECK, 12, M.grate, 0.5));
  solid(-3.3, CEIL, 8.8, -1.1, CEIL + 0.2, 12.2, M.ceil); 
  solid(-3.3, DECK, 9.6, -2.5, -0.3, 11.4, M.dark);                                      // table (0.9 m — blocks)
  vis(-3.32, -0.3, 9.55, -2.45, -0.26, 11.45, M.carbon);
  const sample = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 16), M.cyan); sample.position.set(-2.9, -0.08, 10.5); group.add(sample);
  light(-2.2, 1.0, 10.5, 5, 6, 0xcfe8ff);
  rooms.push({ id: 'lab', name: 'LAB NOOK', min: [-3.3, DECK, 9], max: [-1.1, CEIL, 12] });

  // ── props on the dome deck: low crate (step-over), table (blocks), hanging beam (crouch)
  solid(0.2, PLAT, 17.0, 0.9, PLAT + 0.3, 17.7, M.orange);
  solid(0.3, PLAT, 19.0, 1.0, PLAT + 0.9, 19.8, M.dark);
  solid(-1.1, PLAT + 1.3, 18.0, 0.1, PLAT + 1.7, 18.3, M.hazard);
  vis(0.3, PLAT + 0.9, 19.0, 1.0, PLAT + 0.93, 19.8, M.carbon);

  // ── airlock x[-1.6,1.6] z[20,24] at PLAT (hatch on the port wall)
  wall(-1.8, 20.0, -1.1, 20.2, HIGH); wall(1.1, 20.0, 1.8, 20.2, HIGH);
  wall(-1.8, 20.2, -1.6, 24.2, HIGH); wall(1.6, 20.2, 1.8, 24.2, HIGH); wall(-1.6, 24.0, 1.6, 24.2, HIGH);
  floors.push({ min: [-1.6, 20], max: [1.6, 24], y: PLAT, mat: 'grate' });
  add(boxMesh(-1.6, PLAT - 0.2, 20, 1.6, PLAT, 24, M.grate, 0.5));
  solid(-1.6, HIGH, 20, 1.6, HIGH + 0.2, 24, M.ceil);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 1.1), M.amber); hatch.position.set(-1.57, PLAT + 0.95, 22); group.add(hatch);
  const hatch2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.9), M.dark); hatch2.position.set(-1.55, PLAT + 0.95, 22); group.add(hatch2);
  const hz = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.2), M.hazard); hz.rotation.x = -Math.PI / 2; hz.position.set(-0.6, PLAT + 0.005, 22); group.add(hz);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.46, 0.32), M.carbon); panel.position.set(-1.5, PLAT + 1.1, 23.2); group.add(panel);
  const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.34), screenMats[2]); ps.position.set(-1.446, PLAT + 1.1, 23.2); ps.rotation.y = Math.PI / 2; group.add(ps);
  mkStrip(0, HIGH - 0.01, 22, 0.6, 2.4, M.lightStrip);
  light(0, 2.3, 22, 6, 9);
  rooms.push({ id: 'airlock', name: 'AIRLOCK', min: [-1.6, PLAT, 20], max: [1.6, HIGH, 24] });
  // inner airlock door (uses the `door` flag + space.setDoor) at z=20
  const AL = new THREE.Mesh(new THREE.BoxGeometry(2.2, HIGH - PLAT, 0.14), M.dark); AL.position.set(0, (HIGH + PLAT) / 2, 20.1); group.add(AL);
  colliders.push({ min: [-1.1, PLAT, 20.0], max: [1.1, HIGH, 20.2], door: 'AL_IN' });

  // ── interactables
  const seatEye = { eye: [0, 0, 0], stand: [-0.95, DECK, 0.1], yaw: 0 };
  const space = makeBoxSpace({
    id: 'testdeck', name: 'TEST DECK', gravity: 9.81, spawn: { pos: [-0.95, DECK, 0.1], yaw: 0 }, colliders, floors, interactables, rooms, footstep: 'metal', group,
    update: () => { level.updateCount++; },
  });
  space.entries = { airlock: { pos: [0.4, PLAT, 22], yaw: -Math.PI / 2 } };
  space.setDoor('AL_IN', true);
  const alDoor = { t: 1 };
  const scrN = scr[0];
  const I = (o) => { interactables.push(o); return o; };
  I({ id: 'seat.pilot', label: 'SIT · PILOT SEAT', pos: new V3(0, -0.6, 0.1), radius: 0.8, use: () => ctx.say('ship.sit') });
  I({ id: 'seat.systems', label: 'SYSTEMS STATION', pos: new V3(1.4, -0.6, 1.25), radius: 0.7, use: () => ctx.say('ship.obj.systems') });
  I({ id: 'dash.nav', label: 'NAV DISPLAY', pos: scrN.position.clone(), radius: 0.5, object: scrN, use: () => ctx.say('ship.obj.display') });
  I({ id: 'door.D1', label: () => (D1.open ? 'CLOSE · BULKHEAD DOOR' : 'OPEN · BULKHEAD DOOR'), pos: new V3(1.0, -0.1, 7.5), radius: 0.35,
    use: () => { D1.open = !D1.open; foley.door(D1.open); } });
  I({ id: 'lab.sample', label: 'INSPECT SAMPLE', pos: new V3(-2.9, -0.1, 10.5), radius: 0.6, object: sample, use: () => ctx.say('ship.obj.spectrometer') });
  I({ id: 'crate.scan', label: 'INSPECT CRATE', pos: new V3(0.55, PLAT + 0.15, 17.35), radius: 0.5, use: () => ctx.say('ship.obj.probes') });
  I({ id: 'airlock.door', label: () => (space.isDoorOpen('AL_IN') ? 'CLOSE · INNER HATCH' : 'OPEN · INNER HATCH'), pos: new V3(1.0, PLAT + 0.9, 19.7), radius: 0.4,
    use: () => { const o = space.toggleDoor('AL_IN'); foley.door(o); } });
  I({ id: 'airlock.panel', label: 'AIRLOCK · BEGIN EVA', pos: new V3(-1.45, PLAT + 1.1, 23.2), radius: 0.5, object: panel, use: () => startEva() });

  // exterior (visible from outside; also hull colliders for EVA)
  const exterior = new THREE.Group();
  const eb = (x0, y0, z0, x1, y1, z1, m = M.hull, t = 2) => { exterior.add(boxMesh(x0, y0, z0, x1, y1, z1, m, t)); return { min: [x0, y0, z0], max: [x1, y1, z1] }; };
  const hullCols = [
    eb(-3.4, -2.0, -4.6, 3.4, 2.8, 38),
    eb(-2.2, -1.2, -10, 2.2, 1.7, -4.6),
    eb(-1.6, -1.2, 38, 1.6, 2.0, 44, M.dark, 1),
    eb(-12, 0.3, 24, -3.4, 0.4, 34, M.dark, 1), eb(3.4, 0.3, 24, 12, 0.4, 34, M.dark, 1),
    eb(-12, 1.6, 24, -3.4, 1.7, 34, M.dark, 1), eb(3.4, 1.6, 24, 12, 1.7, 34, M.dark, 1),
  ];
  // name + patch on both flanks, hatch frame, nav lights
  const nameTex = mkTex(1024, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#d8651c'; g.fillRect(0, h * 0.82, w, 6); g.fillStyle = '#1a1f26'; g.font = '900 150px Orbitron, Arial Black, sans-serif'; g.textAlign = 'center'; g.fillText('ORPHEUS', w / 2, 170); g.font = '700 38px Orbitron, sans-serif'; g.fillText('HX-02', w / 2, 236); }, false);
  const nameMat = new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, toneMapped: false, color: 0xd0d4d8 });
  [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), nameMat); p.position.set(s * 3.41, 0.9, 11); p.rotation.y = s * Math.PI / 2; exterior.add(p); });
  const hf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 1.5), M.amber); hf.position.set(-3.43, -0.3, 22); exterior.add(hf);
  const hf2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 1.2), M.dark); hf2.position.set(-3.44, -0.3, 22); exterior.add(hf2);
  const nl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.2, 0.2), toneMapped: false })); nl.position.set(-12, 1.0, 29); exterior.add(nl);
  const nr = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.5, 0.3), toneMapped: false })); nr.position.set(12, 1.0, 29); exterior.add(nr);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.5, 0.2), toneMapped: false })); throat.rotation.x = Math.PI / 2; throat.position.set(0, 0.4, 44.05); exterior.add(throat);

  const api = {
    group, exterior, space, lights, D1, AL: alDoor, interactables, seatEye, hull: { colliders: hullCols, bounds: new THREE.Box3(new V3(-12, -2, -10), new V3(12, 2.8, 44)) },
    airlock: { anchor: [-3.5, -0.3, 22], exit: [-4.3, -0.3, 22], inner: [0.4, PLAT, 22] },
    viewpoints: { drive: [0, 0.4, 44], name: [[-3.45, 0.9, 11], [3.45, 0.9, 11]] },
    updateCount: 0,
    interiorLights(on) { lights.forEach(([l, i]) => { l.intensity = on ? i : 0; }); },
    tick(dt, t) {
      D1.t = THREE.MathUtils.clamp(D1.t + (D1.open ? dt : -dt) / 0.6, 0, 1);
      alDoor.t = THREE.MathUtils.clamp(alDoor.t + (space.isDoorOpen('AL_IN') ? dt : -dt) / 0.5, 0, 1);
      const e = D1.t * D1.t * (3 - 2 * D1.t);
      doorL.position.x = -0.55 - 1.0 * e; doorR.position.x = 0.55 + 1.0 * e;
      AL.position.y = (HIGH + PLAT) / 2 + (HIGH - PLAT) * alDoor.t * 0.98; AL.visible = alDoor.t < 0.99;
      sample.material.color.setScalar(1 + 0.3 * Math.sin(t * 3));
    },
  };
  return api;
}

// background for EVA: stars + a glowing accretion ring + sun
const stars = (() => {
  const n = 2500, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.2832, r = Math.sqrt(1 - u * u), R = 3000; p[i * 3] = Math.cos(a) * r * R; p[i * 3 + 1] = u * R; p[i * 3 + 2] = Math.sin(a) * r * R; const v = 0.4 + Math.random() * 0.9; c[i * 3] = v; c[i * 3 + 1] = v * (0.9 + Math.random() * 0.1); c[i * 3 + 2] = v * 1.1; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, toneMapped: false }));
  pts.frustumCulled = false; pts.visible = false; return pts;
})();
const disk = (() => {
  const t = mkTex(512, 512, (g, w, h) => {
    const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    rg.addColorStop(0.28, 'rgba(0,0,0,0)'); rg.addColorStop(0.34, 'rgba(255,240,210,1)'); rg.addColorStop(0.5, 'rgba(255,150,60,.85)'); rg.addColorStop(0.75, 'rgba(180,60,20,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }, false);
  const m = new THREE.Mesh(new THREE.RingGeometry(150, 1100, 96), new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const s = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const g = new THREE.Group(); g.add(m, s); g.position.set(-2400, 380, 600); g.lookAt(0, 0, 0); g.rotateX(1.2); g.visible = false; return g;
})();
const sun = new THREE.DirectionalLight(0xffd9b0, 0); sun.position.set(-1, 0.35, 0.3);
scene.add(stars, disk, sun, sun.target);
function setExteriorWorld(on) { stars.visible = on; disk.visible = on; sun.intensity = on ? 2.6 : 0; level.interiorLights(!on); level.group.traverse((o) => { if (o.isHemisphereLight) o.intensity = on ? 0.05 : 0.35; }); }

// ───────────────────────────────────────────── modes ─────────────────────────────────────────────
const walk = createWalkMode(ctx), eva = createEvaMode(ctx);
const flightPose = { position: new V3(), quaternion: new THREE.Quaternion(), fov: 75 };
const flight = { // stand-in for core's flight mode: seated at the origin, look around, Enter/E/Space stands up
  name: 'flight', hud: 'flight', yaw: 0, pitch: 0,
  enter(opts = {}) { this.yaw = 0; this.pitch = 0; ui.prompt('<kbd>ENTER</kbd> UNBUCKLE'); setExteriorWorld(false); if (opts.from === 'walk') foley.buckle(); }, // core: flight.enter({from:'walk'}) → foley.buckle()
  exit() { ui.prompt(null); },
  update() { flightPose.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')); },
  cameraPose: () => flightPose,
  onKeyDown(e) { if (e.code === 'Enter' || e.code === 'KeyE') { foley.unbuckle(); modes.set('walk', { space: level.space, from: 'seat', seat: level.seatEye, yaw: this.yaw, pitch: this.pitch }); } }, // core: foley.unbuckle() then setMode('walk', {from:'seat'})
  onKeyUp() {}, onWheel() {}, onMouseDown() {},
  onMouseMove(e) { this.yaw = THREE.MathUtils.clamp(this.yaw - e.movementX * 0.0022, -2.2, 2.2); this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022, -1.2, 1.2); },
};
modeReg.walk = walk; modeReg.eva = eva; modeReg.flight = flight;

function evaOptions() {
  const m = shipLoaded;
  if (m && m.airlock && m.hull) return { anchor: m.airlock.outer, hull: m.hull, pos: m.airlock.evaExit, yaw: Math.PI / 2, space: m.space };
  return { anchor: level.airlock.anchor, hull: level.hull, pos: level.airlock.exit, yaw: Math.PI / 2, viewpoints: level.viewpoints, space: level.space };
}
function startEva(fastForce) {
  const fast = fastForce || qs.get('fast');
  const d = foley.airlock('cycle');
  ctx.ui.toast(`AIRLOCK CYCLE ${fast ? '(fast)' : d.toFixed(1) + ' s'}`);
  walk.exit();
  setTimeout(() => {
    foley.airlock('open'); ctx.say('eva.start');
    setExteriorWorld(true);
    modes.set('eva', evaOptions());
  }, fast ? 300 : d * 1000);
}
function toWalk(from = 'spawn', extra = {}) { setExteriorWorld(false); if (from === 'seat') foley.unbuckle(); modes.set('walk', { space: level.space, from, seat: level.seatEye, ...extra }); }

// ───────────────────────────────────────────── real ship (model.js) ─────────────────────────────────────────────
let shipLoaded = null;
async function loadShip(variant = 'orpheus') {
  const out = $('tests');
  try {
    const mod = await import('../src/ship/model.js');
    if (!mod.buildShip) throw new Error('model.js has no buildShip export');
    const m = await mod.buildShip(ctx, { variant });
    if (shipLoaded) scene.remove(shipLoaded.group);
    shipLoaded = m; ctx.shipModel = m;
    level.group.visible = false; level.exterior.visible = false;
    scene.add(m.group);
    out.innerHTML = `<span class="ok">loaded ${variant}</span> rooms:${(m.space.rooms || []).length} interactables:${(m.space.interactables || []).length} colliders:${m.hull ? m.hull.colliders.length : '?'}`;
    setExteriorWorld(false);
    modes.set('walk', { space: m.space, from: 'seat', seat: m.seats && m.seats.pilot });
  } catch (err) {
    out.innerHTML = `<span class="no">ship model unavailable: ${String(err.message || err).replace(/</g, '&lt;')}</span>`;
    console.warn('[harness] model.js not usable', err);
  }
}

// ───────────────────────────────────────────── input ─────────────────────────────────────────────
addEventListener('keydown', (e) => {
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  const m = modeReg[curMode]; if (m && m.onKeyDown) m.onKeyDown(e);
});
addEventListener('keyup', (e) => { keys.delete(e.code); const m = modeReg[curMode]; if (m && m.onKeyUp) m.onKeyUp(e); });
addEventListener('blur', () => keys.clear());
canvas.addEventListener('click', () => { if (!ctx.input.locked()) ctx.input.requestLock(); });
addEventListener('mousemove', (e) => { const m = modeReg[curMode]; if (m && m.onMouseMove && (ctx.input.locked() || (e.buttons & 1))) m.onMouseMove(e); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ───────────────────────────────────────────── loop ─────────────────────────────────────────────
let last = performance.now(), simTime = 0, paused = false, fps = 0, frames = 0, fpsT = 0;
const statusEl = $('sRows');
function statusRows() {
  const m = modeReg[curMode];
  if (!m) return '';
  const S = m.state || {}, p = curMode === 'walk' ? S.feet : S.pos, rows = [];
  const R = (k, v, c) => rows.push(`<div class="row"><span class="k">${k}</span><span class="v ${c || ''}">${v}</span></div>`);
  R('SPACE', curMode === 'walk' && S.space ? S.space.id : '—');
  if (p) R('POS', `${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)}`);
  if (S.vel) R('SPEED', `${(curMode === 'walk' ? Math.hypot(S.vel.x, S.vel.z) : S.vel.length()).toFixed(2)} m/s`);
  if (curMode === 'walk') { R('STATE', `${S.grounded ? 'GROUND' : S.floating ? 'FLOAT' : 'AIR'}${S.sprinting ? ' · SPRINT' : ''}${S.height < 1.5 ? ' · CROUCH' : ''}`); R('ROOM', S.room ? S.room.name : '—'); }
  if (curMode === 'eva') R('TETHER', `${S.pos.distanceTo(S.anchor).toFixed(1)} / 60 m`);
  R('FPS', fps.toFixed(0));
  return rows.join('');
}
function tickWorld(dt) {
  level.tick(dt, simTime);
  if (shipLoaded && shipLoaded.update) shipLoaded.update(dt, simTime, curMode === 'walk' ? walk.state.feet : null); // real model: doors, lights, screens
  const m = modeReg[curMode];
  if (m) {
    m.update(dt);
    const pose = m.cameraPose();
    camera.position.copy(pose.position); camera.quaternion.copy(pose.quaternion);
    if (camera.fov !== pose.fov) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
  }
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now; simTime += dt;
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; statusEl.innerHTML = statusRows(); $('sMode').textContent = curMode.toUpperCase(); }
  if (paused) return;
  tickWorld(dt);
  renderer.render(scene, camera);
}

// ───────────────────────────────────────────── tool buttons ─────────────────────────────────────────────
function btn(parent, label, fn, cls = '') { const b = document.createElement('button'); b.className = 'b ' + cls; b.textContent = label; b.onclick = (e) => { initAudio(); fn(e, b); }; $(parent).appendChild(b); return b; }
btn('bMode', 'WALK', () => toWalk('spawn')); btn('bMode', 'SIT (FLIGHT)', () => modes.set('flight', {})); btn('bMode', 'STAND UP', () => toWalk('seat')); btn('bMode', 'FOLEY LAB', () => $('lab').classList.toggle('hidden'));
btn('bMode', 'EVA', () => startEva(true)); btn('bMode', 'FLASHLIGHT', () => { const m = modeReg[curMode]; if (m && m.setFlashlight) m.setFlashlight(!m.flashlight); });
const gravBtn = [['1 g', 9.81], ['0.12 g', 1.2], ['0 g', 0]];
gravBtn.forEach(([l, g]) => btn('bMode', l, () => { level.space.gravity = g; log('u', 'GRAV', `${g} m/s²`); }));
[['FLIGHT DECK', [-0.95, DECK, 0.1], 0], ['CORRIDOR', [0, DECK, 4], Math.PI], ['DOOR', [0, DECK, 6.5], Math.PI], ['RAMP', [0, DECK, 10.5], Math.PI], ['DOME DECK', [0, PLAT, 16.6], Math.PI], ['AIRLOCK', [0.4, PLAT, 22], -Math.PI / 2]]
  .forEach(([l, p, y]) => btn('bTele', l, () => { if (curMode !== 'walk') toWalk('pos', { pos: p, yaw: y }); else walk.teleport(p, y); }));
MATERIALS.forEach((m) => btn('bTele', m.toUpperCase(), (e, b) => { level.space.footDefault = m; document.querySelectorAll('#bTele .mat').forEach((x) => x.classList.remove('on')); b.classList.add('on'); log('u', 'FLOOR', m); }, 'mat'));
btn('bShip', 'ORPHEUS (model.js)', () => loadShip('orpheus')); btn('bShip', 'EURYDICE', () => loadShip('eurydice'));
btn('bShip', 'TEST DECK', () => { if (shipLoaded) { scene.remove(shipLoaded.group); shipLoaded = null; ctx.shipModel = null; } level.group.visible = true; level.exterior.visible = true; toWalk('spawn'); });
btn('bTest', 'RUN ALL', () => runTests());

// ───────────────────────────────────────────── foley lab ─────────────────────────────────────────────
let curMat = 'metal';
MATERIALS.forEach((m) => btn('fSteps', m.toUpperCase(), (e, b) => { curMat = m; document.querySelectorAll('#fSteps .mat').forEach((x) => x.classList.remove('on')); b.classList.add('on'); foley.step(m, 1); }, 'mat' + (m === 'metal' ? ' on' : '')));
const seq = (n, dt, fn) => { for (let i = 0; i < n; i++) setTimeout(() => fn(i), i * dt); };
btn('fSteps', '▸ STEP', () => foley.step(curMat, 1)); btn('fSteps', '▸ WALK ×6', () => seq(6, 560, () => foley.step(curMat, 0.62)));
btn('fSteps', '▸ SPRINT ×6', () => seq(6, 310, () => foley.step(curMat, 1.05))); btn('fSteps', '▸ CROUCH ×6', () => seq(6, 780, () => foley.step(curMat, 0.35)));
btn('fSteps', '▸ JUMP+LAND', () => { foley.jump(curMat); setTimeout(() => foley.land(curMat, 5), 620); }); btn('fSteps', '▸ HARD LAND', () => foley.land(curMat, 9));
const MISC = [
  ['door open', (f) => f.door(true)], ['door close', (f) => f.door(false)], ['airlock cycle', (f) => f.airlock('cycle')], ['airlock open', (f) => f.airlock('open')], ['airlock close', (f) => f.airlock('close')],
  ['buckle', (f) => f.buckle()], ['unbuckle', (f) => f.unbuckle()], ['crouch', (f) => f.crouch(true)], ['bump', (f) => f.bump(2.5)], ['tether', (f) => f.tether(2)],
  ...['ok', 'deny', 'warn', 'alarm', 'scan', 'chirp', 'suit', 'terminal', 'click', 'light', 'coffee'].map((k) => ['beep ' + k, (f) => f.beep(k)]),
];
MISC.forEach(([l, fn]) => btn('fMisc', l.toUpperCase(), () => fn(foley)));
let breathing = false, thr = false, hum = false;
btn('fSuit', 'BREATH ON/OFF', (e, b) => { breathing = !breathing; foley.breath(breathing ? 1 : 0); b.classList.toggle('on', breathing); });
btn('fSuit', 'BREATH FAST', () => { breathing = true; foley.breath(2.2); });
btn('fSuit', 'THRUSTER', (e, b) => { thr = !thr; foley.thruster(thr, 0.8); b.classList.toggle('on', thr); }); btn('fSuit', 'THRUST BOOST', () => { thr = true; foley.thruster(true, 1.3); });
btn('fSuit', 'HUM', (e, b) => { hum = !hum; foley.hum(hum, 1); b.classList.toggle('on', hum); }); btn('fSuit', 'STOP ALL', () => { breathing = thr = hum = false; foley.stopAll(); });
setInterval(() => foley.update(0.05), 50);

// ── offline rendering + analysis ──
function fft(re, im) { // in-place radix-2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const ur = re[i + j], ui = im[i + j], vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr; re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
async function renderSound(fn, seconds = 2.5, sr = 44100, raw = false) { // raw: straight into the destination (no compressor / reverb) for level matching
  const off = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr), fake = { audio: raw ? { ctx: off, ready: true, sfx: off.destination, verbIn: null } : makeAudio(off) }, f = createFoley(fake);
  fn(f); if (f.update) f.update(0);
  return off.startRendering();
}
function analyse(buf) {
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = L.length, sr = buf.sampleRate, mono = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) { mono[i] = (L[i] + R[i]) * 0.5; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const blk = Math.floor(sr * 0.01), env = [];
  for (let i = 0; i + blk <= n; i += blk) { let s = 0; for (let j = 0; j < blk; j++) s += mono[i + j] * mono[i + j]; env.push(Math.sqrt(s / blk)); }
  const mx = Math.max(...env, 1e-9);
  let dur = 0; for (let i = 0; i < env.length; i++) if (env[i] > mx * 0.003) dur = (i + 1) * 0.01;  // −50 dB re peak block
  const active = env.filter((v) => v > mx * 0.05), rms = Math.sqrt(active.reduce((a, v) => a + v * v, 0) / Math.max(1, active.length));
  // average spectrum
  const N = 4096, re = new Float32Array(N), im = new Float32Array(N), spec = new Float64Array(N / 2);
  for (let s = 0; s + N <= n; s += N / 2) { for (let i = 0; i < N; i++) { re[i] = mono[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; } fft(re, im); for (let k = 0; k < N / 2; k++) spec[k] += re[k] * re[k] + im[k] * im[k]; }
  let tot = 0, cen = 0, lo = 0, mid = 0, hi = 0, alo = 0, amid = 0, ahi = 0;
  const aw = (f) => { const f2 = f * f; return Math.pow((12194 * 12194 * f2 * f2) / ((f2 + 20.6 * 20.6) * Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * (f2 + 12194 * 12194)), 2); }; // A-weighting (power)
  for (let k = 1; k < N / 2; k++) { const f = k * sr / N, e = spec[k], ea = e * aw(f); tot += e; cen += e * f; if (f < 250) { lo += e; alo += ea; } else if (f < 2000) { mid += e; amid += ea; } else { hi += e; ahi += ea; } }
  // LAmax: loudest A-weighted 2048-sample window (dB, relative) — used to match loudness across materials
  let lamax = -99; { const W = 2048, r2 = new Float32Array(W), i2 = new Float32Array(W); for (let s = 0; s + W <= n; s += 1024) { for (let i = 0; i < W; i++) { r2[i] = mono[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / W)); i2[i] = 0; } fft(r2, i2); let p = 0; for (let k = 1; k < W / 2; k++) p += (r2[k] * r2[k] + i2[k] * i2[k]) * aw(k * sr / W); lamax = Math.max(lamax, 10 * Math.log10(p / (W * W) + 1e-14)); } }
  const at = alo + amid + ahi, db = (v) => (v > 1e-9 ? 20 * Math.log10(v) : -99);
  return { peak: db(peak), rms: db(rms), lamax, dur, centroid: tot ? cen / tot : 0, lo: tot ? lo / tot : 0, mid: tot ? mid / tot : 0, hi: tot ? hi / tot : 0, alo: at ? alo / at : 0, amid: at ? amid / at : 0, ahi: at ? ahi / at : 0 };
}
function drawSpectrogram(cv, buf, fmax = 10000) {
  const mono = buf.getChannelData(0), sr = buf.sampleRate, N = 1024, hop = 256, frames = Math.floor((mono.length - N) / hop), bins = Math.floor(N / 2 * fmax / (sr / 2));
  cv.width = Math.min(frames, 520); cv.height = bins;
  const g = cv.getContext('2d'), img = g.createImageData(cv.width, bins), re = new Float32Array(N), im = new Float32Array(N), stride = frames / cv.width;
  for (let x = 0; x < cv.width; x++) {
    const s = Math.floor(x * stride) * hop;
    for (let i = 0; i < N; i++) { re[i] = mono[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < bins; k++) {
      const dbv = 10 * Math.log10((re[k] * re[k] + im[k] * im[k]) / (N * N) + 1e-12), v = Math.max(0, Math.min(1, (dbv + 95) / 70));
      const o = ((bins - 1 - k) * cv.width + x) * 4, h = v * v;
      img.data[o] = 255 * Math.min(1, h * 2.2); img.data[o + 1] = 255 * Math.min(1, Math.max(0, h * 1.8 - 0.1)); img.data[o + 2] = 255 * Math.min(1, 0.25 + v * 0.9 - h * 0.5); img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}
const LAB = [
  ...MATERIALS.map((m) => [`step ${m}`, (f) => f.step(m, 1), 1.0]),
  ...MATERIALS.map((m) => [`land ${m}`, (f) => f.land(m, 6), 1.3]),
  ['door open', (f) => f.door(true), 1.6], ['door close', (f) => f.door(false), 1.6], ['airlock cycle', (f) => f.airlock('cycle'), 7.2], ['airlock open', (f) => f.airlock('open'), 2.4], ['airlock close', (f) => f.airlock('close'), 2.4],
  ['buckle', (f) => f.buckle(), 1.0], ['unbuckle', (f) => f.unbuckle(), 1.0], ['jump', (f) => f.jump('metal'), 0.8], ['crouch', (f) => f.crouch(true), 0.6], ['bump', (f) => f.bump(3), 1.0], ['tether', (f) => f.tether(2), 1.2],
  ...['ok', 'deny', 'warn', 'alarm', 'scan', 'chirp', 'suit', 'terminal', 'click', 'light'].map((k) => [`beep ${k}`, (f) => f.beep(k), 1.2]), ['beep coffee', (f) => f.beep('coffee'), 2.6],
  ['breath (1 cycle)', (f) => f.breath(1), 5.0], ['thruster', (f) => f.thruster(true, 1), 1.5], ['hum', (f) => f.hum(true, 1), 1.5],
];
const SPEC = ['step metal', 'step grate', 'step rock', 'step sand', 'step ice', 'step snow', 'step crystal', 'land metal', 'door open', 'door close', 'airlock cycle', 'buckle', 'unbuckle', 'breath (1 cycle)', 'thruster', 'bump'];
let analysis = {};
async function analyseAll() {
  const out = $('fOut'); out.innerHTML = '<div class="sub">rendering…</div>';
  const rows = [];
  for (const [name, fn, sec] of LAB) {
    try {
      const buf = await renderSound(fn, sec), a = analyse(buf); analysis[name] = { a, buf };
      const clip = a.peak > -1, quiet = a.peak < -40;
      rows.push(`<tr><td>${name}</td><td>${a.dur.toFixed(2)}</td><td class="${clip ? 'bad' : quiet ? 'warn' : ''}">${a.peak.toFixed(1)}</td><td>${a.rms.toFixed(1)}</td><td>${a.lamax.toFixed(1)}</td><td>${a.centroid.toFixed(0)}</td><td>${(a.lo * 100).toFixed(0)}/${(a.mid * 100).toFixed(0)}/${(a.hi * 100).toFixed(0)}</td><td>${(a.alo * 100).toFixed(0)}/${(a.amid * 100).toFixed(0)}/${(a.ahi * 100).toFixed(0)}</td></tr>`);
    } catch (err) { rows.push(`<tr><td>${name}</td><td colspan="7" class="bad">${String(err.message || err)}</td></tr>`); console.error(name, err); }
  }
  out.innerHTML = `<table class="res"><tr><th>SOUND</th><th>DUR s</th><th>PEAK dB</th><th>RMS dB</th><th>LAmax dB</th><th>CENTROID Hz</th><th>LO/MID/HI %</th><th>A-WEIGHTED %</th></tr>${rows.join('')}</table>`;
  window.__analysis = Object.fromEntries(Object.entries(analysis).map(([k, v]) => [k, v.a]));
  return window.__analysis;
}
async function spectrograms() {
  if (!Object.keys(analysis).length) await analyseAll();
  const host = $('fSp'); host.innerHTML = '';
  for (const name of SPEC) {
    if (!analysis[name]) continue;
    const d = document.createElement('div'), cv = document.createElement('canvas'); d.textContent = name; d.appendChild(cv); host.appendChild(d);
    drawSpectrogram(cv, analysis[name].buf);
  }
}
$('fAnalyse').onclick = () => analyseAll(); $('fSpec').onclick = () => spectrograms();
btn('fSuit', 'LAB FULLSCREEN', () => { const l = $('lab'); const full = l.dataset.full !== '1'; l.dataset.full = full ? '1' : '0'; Object.assign(l.style, full ? { left: '10px', top: '10px', transform: 'none', width: 'calc(100vw - 20px)', maxHeight: 'calc(100vh - 20px)', zIndex: 5 } : { left: '50%', top: '12px', transform: 'translateX(-50%)', width: '', maxHeight: '', zIndex: '' }); });
btn('fSuit', 'HIDE LAB', () => { $('lab').classList.toggle('hidden'); });

// ───────────────────────────────────────────── self tests ─────────────────────────────────────────────
async function runTests() {
  const out = $('tests'), results = [];
  const wasReady = audio.ready; audio.ready = false;       // keep the speakers quiet while stepping thousands of frames
  paused = true;
  const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass, info }); };
  const near = (a, b, e) => Math.abs(a - b) <= e;
  const step = (n, dt = 1 / 60, m = walk) => { for (let i = 0; i < n; i++) m.update(dt); };
  const hold = (codes, sec, m = walk) => { codes.forEach((c) => keys.add(c)); step(Math.round(sec * 60), 1 / 60, m); codes.forEach((c) => keys.delete(c)); };
  const press = (code, m = walk) => { m.onKeyDown({ code, repeat: false }); };
  const reset = (pos, yaw = 0, space = level.space) => { modes.set('walk', { space, from: 'pos', pos, yaw }); walk.teleport(pos, yaw); step(6); };
  const S = walk.state;

  try {
    // 1 spawn
    modes.set('walk', { space: level.space, from: 'spawn' }); step(30);
    ok('spawn rests on the deck', near(S.feet.y, DECK, 0.005) && S.grounded, `y=${S.feet.y.toFixed(3)}`);
    // 2 wall block (dash console front face z=-2.8 → capsule stops at -2.5)
    reset([0, DECK, -1.0], 0); hold(['KeyW'], 5);
    ok('front console blocks (z stops at −2.5)', near(S.feet.z, -2.5, 0.03), `z=${S.feet.z.toFixed(3)}`);
    // 3 wall slide: diagonal into the left corridor wall
    reset([0, DECK, 3.5], 3 * Math.PI / 4); hold(['KeyW'], 3);   // forward = (−x, +z): hits the left wall, slides toward the door
    ok('slides along the wall (x≈−0.8, z keeps advancing)', near(S.feet.x, -0.8, 0.03) && S.feet.z > 5.5 && S.feet.z < 7.6, `x=${S.feet.x.toFixed(3)} z=${S.feet.z.toFixed(3)}`);
    // 4 closed door / open door
    level.D1.open = false; level.D1.t = 0;
    reset([0, DECK, 6.0], Math.PI); hold(['KeyW'], 4);
    ok('closed door blocks (z stops at 7.6)', near(S.feet.z, 7.6, 0.03), `z=${S.feet.z.toFixed(3)}`);
    level.D1.open = true; for (let i = 0; i < 80; i++) level.tick(1 / 60, i / 60);
    hold(['KeyW'], 3);
    ok('open door lets you through', S.feet.z > 9.0, `z=${S.feet.z.toFixed(3)}`);
    // 5 ramp up/down
    reset([0, DECK, 11], Math.PI); hold(['KeyW'], 1.6);
    const zr = S.feet.z, yr = S.feet.y, exp = DECK + (PLAT - DECK) * Math.min(1, Math.max(0, (zr - 12) / 4));
    ok('ramp: feet follow the slope', near(yr, exp, 0.02) && S.grounded && zr > 12.5 && zr < 16, `z=${zr.toFixed(2)} y=${yr.toFixed(3)} expected ${exp.toFixed(3)}`);
    hold(['KeyW'], 3);
    ok('ramp: reaches the dome deck', near(S.feet.y, PLAT, 0.01) && S.feet.z > 16, `y=${S.feet.y.toFixed(3)} z=${S.feet.z.toFixed(2)}`);
    reset([0, PLAT, 17.5], 0); const eyes = []; keys.add('KeyW'); for (let i = 0; i < 600; i++) { walk.update(1 / 60); eyes.push(walk.cameraPose().position.y); if (S.feet.z < 11.7) break; } keys.delete('KeyW');
    ok('ramp: walks back down to the corridor', near(S.feet.y, DECK, 0.005) && S.feet.z < 11.8 && S.grounded, `y=${S.feet.y.toFixed(3)} z=${S.feet.z.toFixed(2)}`);
    let maxd = 0; for (let i = 1; i < eyes.length; i++) maxd = Math.max(maxd, Math.abs(eyes[i] - eyes[i - 1]));
    ok('ramp: eye height changes smoothly (< 4 cm/frame)', maxd < 0.04, `max step ${maxd.toFixed(4)}`);
    // 6 step onto the low crate (0.3 m)
    reset([0.55, PLAT, 16.3], Math.PI); const e6 = []; keys.add('KeyW'); let top = -9;
    for (let i = 0; i < 300; i++) { walk.update(1 / 60); e6.push(walk.cameraPose().position.y); top = Math.max(top, S.feet.y); if (S.feet.z > 18.3) break; } keys.delete('KeyW');
    let m6 = 0; for (let i = 1; i < e6.length; i++) m6 = Math.max(m6, Math.abs(e6[i] - e6[i - 1]));
    ok('crate: steps up to +0.3 m and back down', near(top, PLAT + 0.3, 0.01) && near(S.feet.y, PLAT, 0.01), `top=${top.toFixed(3)} end=${S.feet.y.toFixed(3)}`);
    ok('crate: camera does not pop (< 6 cm/frame)', m6 < 0.06, `max step ${m6.toFixed(4)}`);
    // 7 table blocks
    reset([0.65, PLAT, 18.0], Math.PI); hold(['KeyW'], 4);
    ok('0.9 m table blocks (z stops at 18.7)', near(S.feet.z, 18.7, 0.03), `z=${S.feet.z.toFixed(3)}`);
    // 8 beam: stand blocked, crouch passes, stays crouched underneath
    reset([-0.5, PLAT, 17.0], Math.PI); hold(['KeyW'], 3);
    ok('hanging beam blocks a standing player (z stops at 17.7)', near(S.feet.z, 17.7, 0.03), `z=${S.feet.z.toFixed(3)}`);
    keys.add('ControlLeft'); step(40); hold(['KeyW'], 3);
    ok('crouching passes under the beam', S.feet.z > 18.6 && S.height < 1.3, `z=${S.feet.z.toFixed(2)} h=${S.height.toFixed(2)}`);
    reset([-0.5, PLAT, 17.0], Math.PI); keys.add('ControlLeft'); step(40); keys.add('KeyW'); step(70); keys.delete('KeyW'); keys.delete('ControlLeft'); step(40);
    ok('cannot stand up under the beam', S.feet.z > 18.0 && S.feet.z < 18.3 && S.height < 1.3, `z=${S.feet.z.toFixed(2)} h=${S.height.toFixed(2)}`);
    hold(['KeyW'], 1.5);
    step(30);
    ok('stands again once clear of the beam', S.height > 1.74, `h=${S.height.toFixed(2)}`);
    // 9 jump
    reset([-0.95, DECK, 0.1], 0); press('Space'); let apex = 0, air = 0; for (let i = 0; i < 120; i++) { walk.update(1 / 120); apex = Math.max(apex, S.feet.y - DECK); if (!S.grounded) air += 1 / 120; if (i > 5 && S.grounded) break; }
    ok('1 g jump apex ≈ 0.55 m, air time ≈ 0.67 s', near(apex, 0.555, 0.05) && near(air, 0.67, 0.06), `apex=${apex.toFixed(3)} air=${air.toFixed(2)}`);
    // 10 low gravity + zero-g
    const lg = makeBoxSpace({ id: 'lowg', gravity: 1.2, spawn: { pos: [0, 0, 0] }, floors: [{ min: [-50, -50], max: [50, 50], y: 0 }] });
    reset([0, 0, 0], 0, lg); press('Space'); apex = 0; air = 0; for (let i = 0; i < 1500; i++) { walk.update(1 / 100); apex = Math.max(apex, S.feet.y); if (!S.grounded) air += 0.01; if (i > 5 && S.grounded) break; }
    ok('Charon (1.2 m/s²) jump is floaty: apex ≈ 4 m, air ≈ 5 s', apex > 3.6 && apex < 4.3 && air > 4.6 && air < 5.8, `apex=${apex.toFixed(2)} air=${air.toFixed(2)}`);
    const zg = makeBoxSpace({ id: 'zerog', gravity: 0, spawn: { pos: [0, 0, 0] }, floors: [{ min: [-50, -50], max: [50, 50], y: -2 }], colliders: [{ min: [-5, -2, -5.2], max: [5, 3, -5] }] });
    reset([0, 0, 0], 0, zg); press('Space'); step(30); const y0 = S.feet.y; hold(['KeyW'], 1.5);
    ok('zero-g: floats (no jump, no gravity), W drifts forward and walls stop you', S.floating && near(y0, 0, 0.02) && S.feet.z < -1 && S.feet.z > -4.75, `floating=${S.floating} y0=${y0.toFixed(2)} z=${S.feet.z.toFixed(2)}`);
    // 11 fall + land, void edge
    const spy = []; const origLand = foley.land; foley.land = (...a) => { spy.push(a); return origLand.apply(foley, a); };
    const dr = makeBoxSpace({ id: 'drop', spawn: { pos: [-3, 0, 0], yaw: -Math.PI / 2 }, floors: [{ min: [-6, -4], max: [0, 4], y: 0 }, { min: [0, -4], max: [8, 4], y: -3 }] });
    spy.length = 0;
    reset([-1.0, 0, 0], -Math.PI / 2, dr); hold(['KeyW'], 2.5);
    ok('ledge: falls 3 m, lands on the lower floor with a land sound', near(S.feet.y, -3, 0.01) && S.grounded && spy.length === 1 && spy[0][1] > 6, `y=${S.feet.y.toFixed(2)} lands=${spy.length} v=${spy[0] ? spy[0][1].toFixed(1) : '-'}`);
    foley.land = origLand;
    const vd = makeBoxSpace({ id: 'void', floors: [{ min: [-6, -4], max: [4, 4], y: 0 }] });
    reset([0, 0, 0], -Math.PI / 2, vd); hold(['KeyW'], 4);
    ok('world edge (no floor): blocked, not a fall', near(S.feet.y, 0, 0.001) && near(S.feet.x, 4, 0.02) && S.grounded, `x=${S.feet.x.toFixed(2)} y=${S.feet.y.toFixed(2)}`);
    // 12 sprint speed
    reset([0, DECK, 3], Math.PI); hold(['KeyW', 'ShiftLeft'], 1.5); const sp1 = Math.hypot(S.vel.x, S.vel.z); keys.add('ShiftLeft'); keys.add('KeyW'); step(60); const sp2 = Math.hypot(S.vel.x, S.vel.z); keys.delete('KeyW'); keys.delete('ShiftLeft');
    reset([0, DECK, 3], Math.PI); hold(['KeyW'], 1.5); const wsp = Math.hypot(S.vel.x, S.vel.z);
    ok('walk 1.4 m/s, sprint 3.2 m/s', near(wsp, 1.4, 0.05) && near(sp2, 3.2, 0.1), `walk=${wsp.toFixed(2)} sprint=${sp2.toFixed(2)}`);
    // 12b mouse look + camera pose convention (YXZ; yaw>0 turns left; −Z forward)
    reset([0, DECK, 3], 0); S.pitch = 0; walk.onMouseMove({ movementX: 100, movementY: 50 });
    ok('mouse right/down: yaw −0.22, pitch −0.11 (sens 1)', near(S.yaw, -0.22, 1e-6) && near(S.pitch, -0.11, 1e-6), `yaw=${S.yaw.toFixed(4)} pitch=${S.pitch.toFixed(4)}`);
    ctx.settings.invertY = true; walk.onMouseMove({ movementX: 0, movementY: 100 }); ctx.settings.invertY = false;
    ok('invertY flips pitch', near(S.pitch, -0.11 + 0.22, 1e-6), `pitch=${S.pitch.toFixed(4)}`);
    walk.onMouseMove({ movementX: 0, movementY: -250 }); walk.onMouseMove({ movementX: 0, movementY: -250 }); walk.onMouseMove({ movementX: 0, movementY: -250 }); walk.onMouseMove({ movementX: 0, movementY: -250 });
    ok('pitch is clamped to ±1.5 rad', near(S.pitch, 1.5, 1e-6), `pitch=${S.pitch.toFixed(3)}`);
    S.yaw = 0.7; S.pitch = 0.3; walk.update(0.016); const fq = new V3(0, 0, -1).applyQuaternion(walk.cameraPose().quaternion), cp = Math.cos(0.3);
    ok('cameraPose quaternion looks along (−sin yaw·cos p, sin p, −cos yaw·cos p)', near(fq.x, -Math.sin(0.7) * cp, 0.02) && near(fq.y, Math.sin(0.3), 0.03) && near(fq.z, -Math.cos(0.7) * cp, 0.02), fq.toArray().map((v) => v.toFixed(3)).join(','));
    S.pitch = 0; S.yaw = 0;
    // 12c large frame times must not tunnel (sprint into the closed door at dt = 0.1 s)
    level.D1.open = false; level.D1.t = 0; reset([0, DECK, 3.0], Math.PI); keys.add('KeyW'); keys.add('ShiftLeft'); for (let i = 0; i < 80; i++) walk.update(0.1); keys.delete('KeyW'); keys.delete('ShiftLeft');
    ok('sprinting at dt = 0.1 s cannot tunnel through the 0.2 m door', near(S.feet.z, 7.6, 0.03), `z=${S.feet.z.toFixed(3)}`);
    // 12d footstep events: one per stride (0.78 m), material from the floor under the feet or space.footDefault
    const stepSpy = []; const origStep = foley.step; foley.step = (...a) => { stepSpy.push(a); return origStep.apply(foley, a); };
    level.D1.open = false; level.D1.t = 0; reset([0, DECK, 3.0], Math.PI); hold(['KeyW'], 3.0);
    const corr = stepSpy.slice(); stepSpy.length = 0;
    reset([-1.8, DECK, 9.3], Math.PI); hold(['KeyW'], 1.6); const alc = stepSpy.slice(); stepSpy.length = 0;
    level.space.footDefault = 'sand'; reset([0, DECK, 3.0], Math.PI); hold(['KeyW'], 2.0); const snd = stepSpy.slice(); stepSpy.length = 0;
    level.space.footDefault = 'metal'; foley.step = origStep;
    ok('footsteps: ≈1 per 0.78 m on metal (3 s walk → 4–6 steps)', corr.length >= 4 && corr.length <= 6 && corr.every((a) => a[0] === 'metal'), `${corr.length} steps ${[...new Set(corr.map((a) => a[0]))]}`);
    ok('footsteps: grate floor rectangle overrides the material', alc.length >= 2 && alc.every((a) => a[0] === 'grate'), `${alc.length} steps ${[...new Set(alc.map((a) => a[0]))]}`);
    ok('footsteps: space.footDefault changes unmarked floors', snd.length >= 3 && snd.every((a) => a[0] === 'sand'), `${snd.length} steps ${[...new Set(snd.map((a) => a[0]))]}`);
    // 13 interaction targeting
    reset([-0.95, DECK, 0.1], -Math.PI / 2); // yaw −90° faces +x toward the pilot seat
    step(10); walk.update(0.06);
    ok('facing the pilot seat shows its prompt', /SIT/.test($('hint').innerHTML) && /<kbd>E<\/kbd>/.test($('hint').innerHTML), $('hint').innerHTML);
    walk.teleport([-0.95, DECK, 0.1], Math.PI / 2); walk.update(0.06); walk.update(0.06);
    ok('facing away clears the prompt', $('hint').innerHTML === '', `'${$('hint').innerHTML}'`);
    level.D1.open = false; level.D1.t = 0;
    reset([0.9, DECK, 8.6], 0); step(4); walk.update(0.06); walk.update(0.06);
    ok('door switch behind a closed door is not targetable through the wall', !/DOOR/.test($('hint').innerHTML), `'${$('hint').innerHTML}'`);
    reset([0.45, DECK, 7.45], -Math.PI / 2);
    walk.teleport([0.45, DECK, 7.45], -Math.PI / 2); step(4); walk.update(0.06); walk.update(0.06);
    ok('door switch on the near side is targetable (label is a function)', /OPEN · BULKHEAD DOOR/.test($('hint').innerHTML), `'${$('hint').innerHTML}'`);
    const busEv = []; const onI = (p) => busEv.push(p.id); bus.on('interact', onI);
    press('KeyE'); bus.off('interact', onI);
    ok('E emits `interact` and runs use()', busEv.includes('door.D1') && level.D1.open === true, busEv.join(','));
    level.D1.open = false;
    // ray against a mesh object: nav display
    walk.teleport([-1.55, DECK, -2.2], 0); S.pitch = -0.5; step(4); walk.update(0.06); walk.update(0.06);
    ok('ray against an object mesh (nav display) targets it', /NAV DISPLAY/.test($('hint').innerHTML), `'${$('hint').innerHTML}'`);
    S.pitch = 0;
    // 14 rooms
    const rooms = []; const onR = (p) => rooms.push(p.room); bus.on('room', onR);
    modes.set('walk', { space: level.space, from: 'pos', pos: [0, DECK, 4], yaw: Math.PI }); step(5);
    hold(['KeyW'], 4);
    bus.off('room', onR);
    ok('room events fire on entry (corridor → ...)', rooms[0] === 'corridor' && rooms.length >= 1, rooms.join(' → '));
    // 15 space.update hook
    const u0 = level.updateCount; step(10);
    ok('walk mode calls space.update(dt) every frame', level.updateCount - u0 === 10, `${level.updateCount - u0} calls`);
    // 16 seat transition out + in
    const modeSet = []; const origSet = modes.set; modes.set = (n, o) => { modeSet.push([n, o]); if (n === 'walk') return origSet.call(modes, n, o); };
    modes.set('walk', { space: level.space, from: 'seat', seat: level.seatEye, yaw: 0, pitch: 0 });
    const eye0 = walk.cameraPose().position.clone(); step(27); const eyeM = walk.cameraPose().position.clone();
    ok('stand-up: eye starts at the seat eye, mid-way is between', eye0.length() < 0.02 && eyeM.x < -0.1 && eyeM.y < 0.6, `eye0=${eye0.toArray().map((v) => v.toFixed(2))} mid=${eyeM.toArray().map((v) => v.toFixed(2))}`);
    step(40); const eyeF = walk.cameraPose().position;
    ok('stand-up ends standing at seat.stand (eye 1.66 m above the deck)', !S.trans && near(S.feet.x, -0.95, 0.01) && near(eyeF.y, DECK + 1.66, 0.02), `feet=${S.feet.toArray().map((v) => v.toFixed(2))} eyeY=${eyeF.y.toFixed(3)}`);
    walk.teleport([-0.95, DECK, 0.1], -Math.PI / 2); step(5); walk.update(0.06); walk.update(0.06);
    const lines0 = sayLog.length; press('KeyE'); step(10); const midEye = walk.cameraPose().position.clone(); step(70);
    ok('E on seat.pilot animates back into the seat then sets mode flight {from:"walk"}', modeSet.some(([n, o]) => n === 'flight' && o && o.from === 'walk') && midEye.length() > 0.05, `calls=${JSON.stringify(modeSet.map((m) => m[0]))} mid=${midEye.length().toFixed(2)}`);
    ok('seat.pilot use() also ran', sayLog.length > lines0 && sayLog[sayLog.length - 1] === 'ship.sit' || sayLog.includes('ship.sit'), sayLog.slice(-3).join(','));
    modes.set = origSet; modes.set('walk', { space: level.space, from: 'spawn' });
    // 17 EVA
    modes.set('eva', { anchor: level.airlock.anchor, hull: level.hull, pos: level.airlock.exit, yaw: Math.PI / 2, viewpoints: level.viewpoints, space: level.space });
    const ES = eva.state; step(2, 1 / 60, eva);
    ok('EVA: enters at the hatch with no velocity', ES.pos.distanceTo(new V3(...level.airlock.exit)) < 0.01 && ES.vel.length() < 0.01);
    hold(['KeyW'], 1, eva); const v1 = ES.vel.length(); hold(['KeyW'], 3, eva); const v2 = ES.vel.length();
    ok('EVA: W thrusts forward, capped at 4 m/s', v1 > 1.5 && v2 > 3.6 && v2 < 4.05, `v(1s)=${v1.toFixed(2)} v(4s)=${v2.toFixed(2)}`);
    step(300, 1 / 60, eva); const v3 = ES.vel.length();
    ok('EVA: dampers bleed velocity when idle', v3 < 0.1, `v=${v3.toFixed(3)}`);
    keys.add('KeyW'); step(60, 1 / 60, eva); keys.delete('KeyW'); keys.add('KeyZ'); eva.onKeyDown({ code: 'KeyZ', repeat: false }); keys.delete('KeyZ'); const vz = ES.vel.length(); step(180, 1 / 60, eva);
    ok('EVA: Z turns the dampers off → inertia persists', !ES.damp && ES.vel.length() > vz * 0.9, `v before=${vz.toFixed(2)} after 3 s=${ES.vel.length().toFixed(2)}`);
    eva.onKeyDown({ code: 'KeyZ', repeat: false });
    // fly away from the ship with boost: tether
    modes.set('eva', { anchor: level.airlock.anchor, hull: level.hull, pos: level.airlock.exit, yaw: Math.PI / 2, space: level.space });
    const said0 = sayLog.filter((s) => s === 'eva.tether').length; let maxd2 = 0;
    keys.add('KeyW'); keys.add('ShiftLeft'); for (let i = 0; i < 60 * 25; i++) { eva.update(1 / 60); maxd2 = Math.max(maxd2, ES.pos.distanceTo(ES.anchor)); } keys.delete('KeyW'); keys.delete('ShiftLeft');
    ok('EVA tether: never beyond 60 m, soft-stops, says eva.tether once', maxd2 <= 60.01 && maxd2 > 52 && sayLog.filter((s) => s === 'eva.tether').length - said0 === 1, `max=${maxd2.toFixed(2)} lines=${sayLog.filter((s) => s === 'eva.tether').length - said0}`);
    // hull collision: fly into the hull
    modes.set('eva', { anchor: level.airlock.anchor, hull: level.hull, pos: [-6, -0.3, 22], yaw: -Math.PI / 2, space: level.space });
    keys.add('KeyW'); keys.add('ShiftLeft'); let pen = 99; for (let i = 0; i < 60 * 6; i++) { eva.update(1 / 60); const p = ES.pos, b = level.hull.colliders[0]; const dx = Math.max(b.min[0] - p.x, 0, p.x - b.max[0]), dy = Math.max(b.min[1] - p.y, 0, p.y - b.max[1]), dz = Math.max(b.min[2] - p.z, 0, p.z - b.max[2]); pen = Math.min(pen, Math.hypot(dx, dy, dz)); } keys.delete('KeyW'); keys.delete('ShiftLeft');
    ok('EVA hull collision: stops 0.45 m from the hull (no penetration)', pen > 0.43, `closest=${pen.toFixed(3)}`);
    // return interactable
    modes.set('eva', { anchor: level.airlock.anchor, hull: level.hull, pos: [-4.4, -0.3, 22], yaw: Math.PI / 2, space: level.space });
    const calls2 = []; const origSet2 = modes.set; modes.set = (n, o) => { calls2.push([n, o]); return origSet2.call(modes, n, o); };
    step(10, 1 / 60, eva); eva.onKeyDown({ code: 'KeyR', repeat: false });
    ok('EVA: R near the hatch returns to walk (from:airlock) and says eva.return', calls2.some(([n, o]) => n === 'walk' && o.from === 'airlock') && sayLog.includes('eva.return'), JSON.stringify(calls2.map((c) => c[0])));
    modes.set = origSet2;
    ok('EVA: walk re-entry from the airlock places the player inside', near(S.feet.z, 22, 0.05) && near(S.feet.y, PLAT, 0.01), `feet=${S.feet.toArray().map((v) => v.toFixed(2))}`);
  } catch (err) {
    ok('test run crashed', false, String(err && err.stack || err));
  }
  audio.ready = wasReady; keys.clear(); paused = false; last = performance.now();
  setExteriorWorld(false); modes.set('walk', { space: level.space, from: 'spawn' });
  const pass = results.filter((r) => r.pass).length;
  out.innerHTML = `<div>${pass}/${results.length} passed</div>` + results.map((r) => `<div class="${r.pass ? 'ok' : 'no'}">${r.pass ? '✓' : '✗'} ${r.name}${r.info ? ' — ' + String(r.info).replace(/</g, '&lt;') : ''}</div>`).join('');
  window.__tests = results;
  return results;
}

// ───────────────────────────────────────────── boot ─────────────────────────────────────────────
$('helpBody').innerHTML = walk.help.map(([k, v]) => `<div><kbd>${k}</kbd> ${v}</div>`).join('') + '<div style="margin-top:6px;opacity:.7">EVA: ' + eva.help.map(([k, v]) => `<kbd>${k}</kbd> ${v}`).join(' · ') + '</div>';
window.__walk = {
  ctx, walk, eva, flight, level, scene, camera, renderer, foley, keys, modes, toWalk, startEva, loadShip, runTests, analyseAll, spectrograms, renderSound, analyse, setPaused: (v) => { paused = v; },
  step: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) { simTime += dt; tickWorld(dt); } renderer.render(scene, camera); },
  mouse: (dx, dy) => { const m = modeReg[curMode]; m.onMouseMove({ movementX: dx, movementY: dy }); },
};
if (qs.get('ship')) loadShip(qs.get('ship'));
else if (qs.get('start') === 'flight') modes.set('flight', {});
else if (qs.get('start') === 'eva') { toWalk('spawn'); startEva(true); }
else toWalk('spawn');
if (qs.get('light')) { walk.setFlashlight(true); eva.setFlashlight(true); }
requestAnimationFrame(loop);
if (qs.get('test')) setTimeout(() => runTests(), 600);
