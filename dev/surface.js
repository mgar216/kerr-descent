// ORPHEUS · full surface harness. Fake `ctx` + a faithful miniature of the core render pipeline:
//   ray-traced-background stand-in (stars + black-disk/orange-ring 'Erebus', × exposure) → near scene (absolute lighting) into an HDR target → lens-style tone map.
//   http://localhost:5173/dev/surface.html?body=asphodel&site=meadow&anim=0&cam=0,1.7,30,0,0&sun=36&az=-35&clean=1
// params: body, site, anim (1 = play landing), sun (elev°), az (°), cam=x,y,z,yawDeg,pitchDeg (ship space, eye), walk=1, ship=none|box|real, exp, clean, scale (render scale), poi=<slotId>[,dist,azDeg,elDeg]
// window.__surf = { ctx, surface, enter(body,site,{instant}), exit(), reset(), setCam(), setSun(el,az), focus(slot,dist,az,el), walk(bool), stats() }
import * as THREE from 'three';
import { createSurface } from '../src/world/surface.js';
import { SITES, dirFromAzEl } from '../src/world/terrain/sites.js';

const Q = new URLSearchParams(location.search);
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance', preserveDrawingBuffer: true, alpha: false, stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scale = +(Q.get('scale') ?? 1);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5) * scale);
if (Q.has('clean')) document.body.classList.add('clean');

const near = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.05, 5e5);
const bgScene = new THREE.Scene();
let rt = null;
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
  const dw = renderer.domElement.width, dh = renderer.domElement.height;
  rt?.dispose(); rt = new THREE.WebGLRenderTarget(dw, dh, { type: THREE.HalfFloatType, depthBuffer: true, samples: +(Q.get('msaa') ?? 4) });
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ───────────── background (ray-traced sky stand-in): stars, Erebus ring, anti-sky galaxy ─────────────
const bgUniforms = { uSun: { value: new THREE.Vector3(0, 1, 0) }, uExp: { value: +(Q.get('exp') ?? 1) }, uMode: { value: 0 }, uPar: { value: new THREE.Vector3(-0.45, 0.62, -0.64).normalize() }, uParR: { value: 23.5 } };
const bgMat = new THREE.ShaderMaterial({
  uniforms: bgUniforms, depthTest: false, depthWrite: false, side: THREE.BackSide,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = vec4(p.xy, p.w, p.w); }`,
  fragmentShader: `
    uniform vec3 uSun; uniform float uExp; uniform float uMode; uniform vec3 uPar; uniform float uParR; varying vec3 vDir;
    float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    void main(){
      vec3 d = normalize(vDir); vec3 col = vec3(0.0);
      vec3 g = d * 260.0; vec3 id = floor(g); vec3 f = fract(g) - 0.5; float h = h13(id);
      col += vec3(1.0, 0.95, 0.9) * step(0.982, h) * smoothstep(0.42, 0.0, length(f)) * (0.35 + 0.9 * h13(id + 7.3)) * 0.9;
      vec3 g2 = d * 90.0; vec3 id2 = floor(g2); vec3 f2 = fract(g2) - 0.5; float h2 = h13(id2 + 3.1);
      col += vec3(0.8, 0.9, 1.0) * step(0.992, h2) * smoothstep(0.45, 0.0, length(f2)) * 1.6;
      float band = exp(-pow(dot(d, normalize(vec3(0.25, 0.8, 0.3))) * 3.2, 2.0)); col += vec3(0.05, 0.06, 0.09) * band;
      vec3 s = normalize(uSun); float ang = degrees(acos(clamp(dot(d, s), -1.0, 1.0)));
      if (uMode > 1.5) {            // Charon: small fiery Erebus ring + Lethe filling the sky (banded giant with rings)
        float ring = exp(-pow((ang - 1.15) / 0.22, 2.0));
        col += vec3(1.0, 0.55, 0.2) * ring * 9.0 * step(ang, 2.5);
        vec3 par = normalize(uPar); float sr = sin(radians(uParR));
        vec3 up = normalize(vec3(0.0, 1.0, 0.0) - par * par.y), rg = cross(par, up);
        vec2 q = vec2(dot(d, rg), dot(d, up)) / sr; if (dot(d, par) < 0.0) q = vec2(9.0);
        float r2 = dot(q, q); float tilt = 0.35; vec2 e = vec2(cos(tilt) * q.x - sin(tilt) * q.y, sin(tilt) * q.x + cos(tilt) * q.y);
        float rr = length(vec2(e.x, e.y / 0.24)); float inRing = smoothstep(1.28, 1.34, rr) * (1.0 - smoothstep(1.95, 2.0, rr)) * (0.55 + 0.45 * sin(rr * 38.0)) * (1.0 - smoothstep(1.62, 1.66, rr) * step(1.62, rr) * step(rr, 1.7) * 0.8);
        vec3 ringCol = vec3(0.62, 0.6, 0.72) * 0.42 * inRing;
        if (r2 < 1.0) {
          float z = sqrt(1.0 - r2); vec3 n3 = rg * q.x + up * q.y - par * z; float lit = 0.25 + 0.75 * max(dot(n3, s) * 0.5 + 0.5, 0.0);
          float band = 0.5 + 0.5 * sin(q.y * 15.0 + sin(q.x * 3.0 + q.y * 4.0) * 0.7 + sin(q.y * 41.0) * 0.25);
          vec3 pc = mix(vec3(0.46, 0.50, 0.86), vec3(0.74, 0.62, 0.92), band) * (0.55 + 0.45 * z) * lit * 0.62;
          col = pc + ringCol * step(e.y, 0.0);                       // front half of the ring over the planet
        } else col += ringCol;
      } else if (uMode < 0.5) {
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

// ───────────── tone-map pass (copy of the core lens pass look) ─────────────
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

// ───────────── placeholder ship (shape, shadows, ramp, colliders) ─────────────
const GROUND = -4.6;
function makePlaceholderShip() {
  const g = new THREE.Group(); g.name = 'ship-placeholder';
  const white = new THREE.MeshStandardMaterial({ color: 0xcfd3d5, roughness: 0.5, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6, metalness: 0.5 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe8741c, roughness: 0.5 });
  const cy = GROUND + 6.0;
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 40, 28).rotateX(Math.PI / 2), white), 0, cy, 13);
  add(new THREE.Mesh(new THREE.ConeGeometry(3.3, 8.5, 28).rotateX(-Math.PI / 2), white), 0, cy, -11.25);
  add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 3.4), dark), 0, cy + 2.4, -7.5);
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.3, 2.4, 6, 24).rotateX(Math.PI / 2), dark), 0, cy, 36);
  add(new THREE.Mesh(new THREE.ConeGeometry(2.3, 4.5, 24).rotateX(Math.PI / 2), dark), 0, cy, 41.2);
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.34, 3.34, 1.0, 28).rotateX(Math.PI / 2), orange), 0, cy, 4);
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.34, 3.34, 0.5, 28).rotateX(Math.PI / 2), orange), 0, cy, 6);
  for (const sx of [-1, 1]) for (const z of [26, 33]) add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 7), white), sx * 4.2, cy + 0.2, z);
  const legs = new THREE.Group(); g.add(legs);
  for (const [x, z] of [[-3.8, -2], [3.8, -2], [-3.8, 30], [3.8, 30]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.6, 10), dark); l.position.set(x, GROUND + 2.3 + 0.4, z); l.castShadow = true; legs.add(l);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.18, 14), dark); f.position.set(x, GROUND + 0.09, z); f.castShadow = true; legs.add(f);
  }
  const foot = [0, GROUND, 36.5], top = [0, GROUND + 3.35, 27.5];
  const rl = Math.hypot(foot[2] - top[2], top[1] - foot[1]);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, rl), dark);
  ramp.position.set(0, (foot[1] + top[1]) / 2, (foot[2] + top[2]) / 2); ramp.rotation.x = Math.atan2(top[1] - foot[1], foot[2] - top[2]); ramp.castShadow = ramp.receiveShadow = true; g.add(ramp);
  const bounds = new THREE.Box3(new THREE.Vector3(-6, GROUND, -12), new THREE.Vector3(6, GROUND + 9.4, 44));
  return {
    group: g, variant: 'orpheus',
    landing: { groundY: GROUND, rampFoot: foot, rampTop: top },
    hull: { colliders: [{ min: [-3.4, GROUND + 3.0, -12], max: [3.4, GROUND + 9.3, 40] }, { min: [-4.5, GROUND, -3], max: [-3.1, GROUND + 3.2, -1] }, { min: [3.1, GROUND, -3], max: [4.5, GROUND + 3.2, -1] }, { min: [-4.5, GROUND, 29], max: [-3.1, GROUND + 3.2, 31] }, { min: [3.1, GROUND, 29], max: [4.5, GROUND + 3.2, 31] }], bounds },
    setLanded(b) { legs.visible = !!b; }, setThrust() {}, update() {},
  };
}

// ───────────── fake ctx ─────────────
const infoEl = document.getElementById('info'), promptEl = document.getElementById('prompt');
const logLines = [];
const log = (...a) => { logLines.push(a.join(' ')); if (logLines.length > 7) logLines.shift(); console.log('[surf]', ...a); };
const handlers = new Map();
const sunOverride = { el: null, az: null };
const ctx = {
  THREE, renderer, scenes: { near }, cameras: { near: camera }, view: { exposure: 1 },
  obs: { bhApp: [0, 0.5, -0.8] }, ship: { S: new Float64Array(20) },
  audio: { ready: false, ctx: null }, fx: { flash: 0, flashCol: [1, 1, 1], glitch: 0, shake: 0 },
  say: (id) => log('say', id), codex: { unlock: (id) => log('codex.unlock', id), isUnlocked: () => false },
  bus: { on: (e, f) => { (handlers.get(e) || handlers.set(e, []).get(e)).push(f); }, off() {}, emit: (e, p) => { log('bus', e, JSON.stringify(p)); (handlers.get(e) || []).forEach((f) => f(p)); } },
  spaces: { enter: (id, entry) => log('spaces.enter', id, entry) }, flags: { once: (k, f) => f(), get: () => null, set() {} },
  ui: { toast: (h) => log('toast', h), prompt: (h) => { promptEl.style.display = h ? 'block' : 'none'; if (h) promptEl.innerHTML = h; }, subtitle: () => {} },
  input: { keys: new Set(), locked: () => false }, modes: { set() {}, current: () => 'walk' },
  surfaceSunOverride: null,
};
let shipKind = Q.get('ship') || 'box', shipModel = null;
async function setupShip() {
  if (shipKind === 'none') return;
  if (shipKind === 'real') {
    try {
      const m = await import('../src/ship/model.js'); const sm = m.buildShip(ctx, { variant: 'orpheus' });
      near.add(sm.group); ctx.shipModel = shipModel = sm; return;
    } catch (e) { log('real ship unavailable:', e.message); }
  }
  shipModel = makePlaceholderShip(); near.add(shipModel.group); ctx.shipModel = shipModel;
}

const surface = createSurface(ctx);
ctx.surface = surface;

// ───────────── camera / walking ─────────────
const cam = { pos: new THREE.Vector3(0, 1.7, 30), yaw: 0, pitch: 0, walk: false, vy: 0, feet: new THREE.Vector3(), grounded: false };
const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyF') toggleWalk(); if (e.code === 'KeyE') interactNearest(); });
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
canvas.addEventListener('pointerup', () => { drag = null; canvas.style.cursor = 'grab'; });
canvas.addEventListener('pointermove', (e) => { if (!drag) return; cam.yaw -= (e.clientX - drag.x) * 0.0035; cam.pitch = Math.max(-1.55, Math.min(1.55, cam.pitch - (e.clientY - drag.y) * 0.0035)); drag.x = e.clientX; drag.y = e.clientY; });
function setCam(x, y, z, yawDeg = 0, pitchDeg = 0) { cam.pos.set(x, y, z); cam.yaw = yawDeg * Math.PI / 180; cam.pitch = pitchDeg * Math.PI / 180; cam.walk = false; cam.vy = 0; }
function toggleWalk(force) {
  const sp = surface.space; if (!sp) return;
  cam.walk = force ?? !cam.walk;
  if (cam.walk) { cam.feet.set(cam.pos.x, cam.pos.y - 1.66, cam.pos.z); const f = sp.floorAt(cam.feet.x, cam.feet.z, cam.feet.y + 0.4); cam.feet.y = f ?? cam.feet.y; cam.vy = 0; }
}
function spawn() { const sp = surface.space; if (!sp) return; cam.feet.set(...sp.spawn.pos); cam.yaw = sp.spawn.yaw; cam.pitch = -0.1; cam.walk = true; cam.vy = 0; }
function interactNearest() {
  const sp = surface.space; if (!sp) return;
  let best = null, bd = 1e9; const p = cam.walk ? cam.feet : cam.pos;
  for (const it of sp.interactables) { const d = Math.hypot(it.pos.x - p.x, it.pos.z - p.z); if (d < it.radius + 0.5 && d < bd) { best = it; bd = d; } }
  if (best) best.use();
}
const fwd = new THREE.Vector3(), rgt = new THREE.Vector3();
function stepCamera(dt) {
  const sp = surface.space; const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const mf = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), mr = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  if (cam.walk && sp) {
    const sp0 = (sprint ? 6.0 : 3.2); const dx = (-sy * mf + cy * mr) * sp0 * dt, dz = (-cy * mf - sy * mr) * sp0 * dt;
    const nx = cam.feet.x + dx, nz = cam.feet.z + dz;
    const fl = sp.floorAt(nx, nz, cam.feet.y);
    if (fl !== null) { cam.feet.x = nx; cam.feet.z = nz; }
    else { const f2 = sp.floorAt(nx, cam.feet.z, cam.feet.y); if (f2 !== null) cam.feet.x = nx; else { const f3 = sp.floorAt(cam.feet.x, nz, cam.feet.y); if (f3 !== null) cam.feet.z = nz; } }
    sp.collide(cam.feet, 0.35, 1.75);
    const floor = sp.floorAt(cam.feet.x, cam.feet.z, cam.feet.y + 0.46);
    cam.vy -= sp.gravity * dt;
    if (keys.has('Space') && cam.grounded) { cam.vy = Math.sqrt(2 * sp.gravity * 0.9); cam.grounded = false; }
    cam.feet.y += cam.vy * dt;
    if (floor !== null && cam.feet.y <= floor) { cam.feet.y = floor; cam.vy = 0; cam.grounded = true; } else if (floor !== null && cam.feet.y - floor < 0.06) cam.grounded = true; else cam.grounded = false;
    cam.pos.set(cam.feet.x, cam.feet.y + 1.66, cam.feet.z);
  } else {
    const sp0 = (sprint ? 60 : 12) * (keys.has('KeyX') ? 8 : 1); const my = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
    const cp = Math.cos(cam.pitch), spch = Math.sin(cam.pitch);
    fwd.set(-sy * cp, spch, -cy * cp); rgt.set(cy, 0, -sy);
    cam.pos.addScaledVector(fwd, mf * sp0 * dt).addScaledVector(rgt, mr * sp0 * dt); cam.pos.y += my * sp0 * dt * (keys.has('KeyE') ? 0 : 1);
  }
  camera.position.copy(cam.pos); camera.rotation.set(cam.pitch, cam.yaw, 0, 'YXZ'); camera.updateMatrixWorld();
}

// ───────────── sun control (fake worlds.skyAt through ctx.surfaceSunOverride) ─────────────
function setSun(el, az) {
  if (el === null || el === undefined) { ctx.surfaceSunOverride = null; sunOverride.el = sunOverride.az = null; return; }
  sunOverride.el = el; sunOverride.az = az;
  const a = dirFromAzEl(az, el); ctx.surfaceSunOverride = surface.siteInfo?.biome === 'elysium' ? { el, az } : a;
}
function currentSun() { return surface._state?.sunDir || new THREE.Vector3(0, 1, 0); }

// ───────────── frame ─────────────
let last = performance.now(), frames = 0, ema = 16, acc = 0;
renderer.info.autoReset = false;
function frame() {
  renderer.info.reset();
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1); last = now;
  stepCamera(dt);
  surface.update(dt);
  shipModel?.update?.(dt, now / 1000);
  const sd = currentSun(); bgUniforms.uSun.value.copy(sd); bgUniforms.uMode.value = surface.siteInfo?.biome === 'elysium' ? 1 : surface.siteInfo?.biome === 'charon' ? 2 : 0;
  { const fd = surface._state?.fillDir; if (fd) bgUniforms.uPar.value.copy(fd); }
  // sky stand-in follows the camera; exposure stays 1 (harness) unless ?exp
  renderer.setRenderTarget(rt); renderer.autoClear = true; renderer.setClearColor(0x000000, 1); renderer.clear();
  renderer.autoClear = false; renderer.render(bgScene, camera);
  renderer.clearDepth(); renderer.render(near, camera);
  renderer.setRenderTarget(null); renderer.autoClear = true; postMat.uniforms.tex.value = rt.texture; renderer.render(post, postCam);
  // HUD
  ema += (dt * 1000 - ema) * 0.1; acc += dt;
  if (!Q.has('clean') && (frames++ % 10) === 0) {
    const sp = surface.space; let pr = '';
    if (sp) { const p = cam.walk ? cam.feet : cam.pos; for (const it of sp.interactables) if (Math.hypot(it.pos.x - p.x, it.pos.z - p.z) < it.radius + 0.5) { pr = `[E] ${typeof it.label === 'function' ? it.label() : it.label}`; break; } }
    ctx.ui.prompt(pr || null);
    infoEl.textContent = `${surface.siteInfo ? surface.siteInfo.bodyName + ' · ' + surface.siteInfo.name : 'no surface'}  ${ema.toFixed(1)} ms   pos ${cam.pos.x.toFixed(1)}, ${cam.pos.y.toFixed(1)}, ${cam.pos.z.toFixed(1)}  ${cam.walk ? 'WALK' : 'FLY'}\n` + logLines.join('\n');
  }
  requestAnimationFrame(frame);
}

// ───────────── UI ─────────────
const ui = document.getElementById('ui');
ui.innerHTML = `<b>ORPHEUS · surface</b> <span style="float:right;opacity:.6">drag look · WASD · Q/E · F walk · E use</span>
<div class="row"><label>body</label><select id="selB"></select> <select id="selS"></select></div>
<div class="row"><label>sun elev</label><input id="sEl" type="range" min="-10" max="85" value="30" style="width:170px"> <span id="vEl"></span></div>
<div class="row"><label>sun az</label><input id="sAz" type="range" min="-180" max="180" value="0" style="width:170px"> <span id="vAz"></span></div>
<div class="row"><button id="bLand">Land (anim)</button><button id="bInst">Enter instant</button><button id="bTake">Take off</button><button id="bWalk">Walk/Fly</button></div>
<div class="row" id="pois"></div>`;
const selB = ui.querySelector('#selB'), selS = ui.querySelector('#selS');
Object.keys(SITES).forEach((b) => selB.add(new Option(b, b)));
function fillSites() { selS.innerHTML = ''; Object.keys(SITES[selB.value]).forEach((s) => selS.add(new Option(s, s))); }
selB.onchange = fillSites;
async function doEnter(body, site, instant) {
  const t0 = performance.now();
  const info = await surface.enter(body, site, { instant });
  log('enter', body, site, (performance.now() - t0).toFixed(0) + ' ms', JSON.stringify(Object.fromEntries(Object.entries(surface._state?.buildMs || {}).map(([k, v]) => [k, +v.toFixed(1)]))));
  const el = ui.querySelector('#pois'); el.innerHTML = '';
  for (const k of Object.keys(SITES[body][site].slots)) { const b = document.createElement('button'); b.textContent = k; b.onclick = () => focus(k); el.appendChild(b); }
  const sl = SITES[body][site].look; ui.querySelector('#sEl').value = sl.elev; ui.querySelector('#sAz').value = sl.az; updSun();
  return info;
}
function focus(slotId, dist = 18, azDeg = 25, elDeg = 12, height = 1.8) {
  const s = SITES[surface.siteInfo.bodyId][surface.siteInfo.siteId].slots[slotId]; if (!s) return;
  const y = surface._state.hf.groundY(s.x, s.z) + height; const a = s.yaw + azDeg * Math.PI / 180, e = elDeg * Math.PI / 180;
  const px = s.x + Math.sin(a) * Math.cos(e) * dist, pz = s.z + Math.cos(a) * Math.cos(e) * dist, py = y + Math.sin(e) * dist;
  const dx = s.x - px, dz = s.z - pz, dy = y - py;
  setCam(px, py, pz, Math.atan2(-dx, -dz) * 180 / Math.PI, Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI);
}
function updSun() { const el = +ui.querySelector('#sEl').value, az = +ui.querySelector('#sAz').value; ui.querySelector('#vEl').textContent = el + '°'; ui.querySelector('#vAz').textContent = az + '°'; setSun(el, az); }
ui.querySelector('#sEl').oninput = updSun; ui.querySelector('#sAz').oninput = updSun;
ui.querySelector('#bLand').onclick = () => { cam.walk = false; setCam(0, 0, 0, 0, -8); doEnter(selB.value, selS.value, false); };
ui.querySelector('#bInst').onclick = () => doEnter(selB.value, selS.value, true);
ui.querySelector('#bTake').onclick = () => { setCam(0, 0, 0, 0, -8); surface.exit(); };
ui.querySelector('#bWalk').onclick = () => toggleWalk();

// ───────────── boot ─────────────
await setupShip();
const body0 = Q.get('body') || 'asphodel', site0 = Q.get('site') || Object.keys(SITES[body0])[0];
selB.value = body0; fillSites(); selS.value = site0;
if (Q.has('sun') || Q.has('az')) { /* applied after enter */ }
const camQ = Q.get('cam');
if (camQ) { const v = camQ.split(',').map(Number); setCam(v[0], v[1], v[2], v[3] || 0, v[4] || 0); } else setCam(0, 0, 0, 0, -6);
const animFlag = Q.get('anim') === '1';
const enterP = doEnter(body0, site0, !animFlag);
if (animFlag) await Promise.race([enterP, new Promise((r) => setTimeout(r, 200))]); else await enterP;
if (Q.has('sun') || Q.has('az')) { ui.querySelector('#sEl').value = Q.get('sun') ?? SITES[body0][site0].look.elev; ui.querySelector('#sAz').value = Q.get('az') ?? SITES[body0][site0].look.az; updSun(); }
if (Q.get('poi')) { const [slot, d, a, e, h] = Q.get('poi').split(','); focus(slot, +(d || 18), +(a || 25), +(e || 12), +(h || 1.8)); }
if (Q.get('walk') === '1') { if (camQ) { cam.walk = true; toggleWalk(true); } else spawn(); }
frame();

window.__surf = { ctx, surface, THREE, renderer, camera, near, enter: doEnter, exit: () => surface.exit(), reset: () => surface.reset(), setCam, setSun, focus, walk: toggleWalk, spawn, cam, log, SITES,
  stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length, ms: ema }) };
