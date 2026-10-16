// ORPHEUS — worlds harness: renders every body through the real createWorlds() far pass with a fake flat-space ctx.
// URL: ?body=lethe&dist=6&phase=120&elev=20&exp=6&yaw=0&scale=0.5&q=fast|full&bh=1&t=0&auto=1&clean=1&fov=60
import * as THREE from 'three';
import { createWorlds } from '../src/world/space.js';
import { bodies, byId, LIGHT, KM_PER_M } from '../src/world/catalog.js';

const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const P = {
  body: Q.get('body') || 'asphodel', phase: +(Q.get('phase') ?? 60), elev: +(Q.get('elev') ?? 15), exp: +(Q.get('exp') ?? 6),
  yaw: +(Q.get('yaw') ?? 0), scale: +(Q.get('scale') ?? 0.5), quality: Q.get('q') || 'full', bh: Q.get('bh') === '1', t: +(Q.get('t') ?? 0),
  fov: +(Q.get('fov') ?? 60), dt: +(Q.get('dt') ?? 0.2), auto: Q.get('auto') === '1', dist: Q.has('dist') ? +Q.get('dist') : null,
};
if (Q.get('clean') === '1') document.body.classList.add('clean');

// ── flat-space stand-in for the core's kerr helpers (identical semantics, η metric) ─────────────────────────────────
const gdot = (X, s, v, w) => -v[0] * w[0] + v[1] * w[1] + v[2] * w[2] + v[3] * w[3];
const kerr = {
  gdot, ksR: (x, y, z, s) => s * Math.hypot(x, y, z), mparts: (x, y, z, s) => ({ r: s * Math.hypot(x, y, z), f: 0, k1: 0, k2: 0, k3: 0, D: 0 }),
  orthonormalize(S) {
    const uu = gdot(null, 1, S.subarray(4, 8), S.subarray(4, 8));
    if (!(uu < 0)) return false;
    const nu = 1 / Math.sqrt(-uu);
    for (let m = 4; m < 8; m++) S[m] *= nu;
    for (let i = 0; i < 3; i++) {
      const o = 8 + 4 * i, ov = S.subarray(o, o + 4), U = S.subarray(4, 8);
      const eu = gdot(null, 1, ov, U);
      for (let m = 0; m < 4; m++) S[o + m] += eu * S[4 + m];
      for (let j = 0; j < i; j++) { const oj = 8 + 4 * j, ee = gdot(null, 1, S.subarray(o, o + 4), S.subarray(oj, oj + 4)); for (let m = 0; m < 4; m++) S[o + m] -= ee * S[oj + m]; }
      const n2 = gdot(null, 1, S.subarray(o, o + 4), S.subarray(o, o + 4));
      if (!(n2 > 0)) return false;
      const n = 1 / Math.sqrt(n2);
      for (let m = 0; m < 4; m++) S[o + m] *= n;
    }
    return true;
  },
  toBody: (v, S) => [gdot(null, 1, v, S.subarray(12, 16)), gdot(null, 1, v, S.subarray(16, 20)), gdot(null, 1, v, S.subarray(8, 12))],
  apparentBody(D) {
    const S = ship.S, U = S.subarray(4, 8), ref = [1, 0, 0, 0];
    const l = Math.hypot(D[0], D[1], D[2]) || 1, d = [0, D[0] / l, D[1] / l, D[2] / l];
    const k = [ref[0] - d[0], ref[1] - d[1], ref[2] - d[2], ref[3] - d[3]];
    const gku = gdot(null, 1, k, U);
    const kk = k.map((c, m) => -(c + gku * U[m]));
    const b = kerr.toBody(kk, S);
    const n = Math.hypot(b[0], b[1], b[2]) || 1;
    return [b[0] / n, b[1] / n, b[2] / n];
  },
};

// ── fake ctx ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
renderer.getContext().getExtension('EXT_color_buffer_float');
renderer.getContext().getExtension('EXT_float_blend');
const logEl = $('log');
const logLines = [];
const logMsg = (m) => { logLines.push(m); while (logLines.length > 6) logLines.shift(); logEl.textContent = logLines.join('\n'); console.log('[ctx]', m); };
const flagStore = {};
const ship = { S: new Float64Array(20), sheet: 1, universe: 0, lock: null };
const listeners = {};
const ctx = {
  THREE, renderer, ship, kerr, K: { a: 0.95, rp: 1.312, rm: 0.688 }, units: { KM_PER_M },
  view: { exposure: P.exp }, fx: { shake: 0, flash: 0, glitch: 0, flashCol: [1, 1, 1] },
  flags: { once: (k, fn) => { if (!flagStore[k]) { flagStore[k] = 1; fn(); } }, get: (k) => flagStore[k], set: (k, v) => { flagStore[k] = v; } },
  codex: { unlock: (id) => logMsg('codex+ ' + id), isUnlocked: () => false },
  say: (id, o) => logMsg('say ' + id + (o && o.delay ? ' (+' + o.delay + 's)' : '')),
  mcReact: (id) => logMsg('mc ' + id),
  bus: { on: (e, f) => { (listeners[e] = listeners[e] || []).push(f); }, off() {}, emit: (e, p) => { logMsg('emit ' + e + ' ' + JSON.stringify(p || {})); (listeners[e] || []).forEach((f) => f(p)); } },
  audio: { whoosh: () => logMsg('audio whoosh'), boom: () => logMsg('audio boom'), clank: () => logMsg('audio clank') },
  ui: { fade: (toBlack, ms = 600) => new Promise((res) => { $('fade').style.opacity = toBlack ? 1 : 0; setTimeout(res, Math.min(ms, 400)); }) },
  surface: { enter: async (b, s, o) => { logMsg(`surface.enter ${b}/${s}`); await new Promise((r) => setTimeout(r, 300)); if (o && o.onReady) o.onReady(); await new Promise((r) => setTimeout(r, 1500)); }, exit: async () => { logMsg('surface.exit'); await new Promise((r) => setTimeout(r, 3600)); } },
  nav: { current: () => null },
};
const worlds = createWorlds(ctx, { quality: P.quality });
window.__worlds = worlds; window.__ctx = ctx;

// ── render targets / helper passes ───────────────────────────────────────────────────────────────────────────────────
let W = 0, H = 0, bhRT, mainRT;
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeo = new THREE.PlaneGeometry(2, 2);
const vertQ = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const bgMat = new THREE.ShaderMaterial({
  vertexShader: vertQ, depthTest: false, depthWrite: false,
  uniforms: { uAspect: { value: 1 }, uBH: { value: 0 } },
  fragmentShader: `
varying vec2 vUv; uniform float uAspect, uBH;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz)*p3.zy); }
float stars(vec2 uv, float sc, float dens){
  vec2 q = uv*sc, i = floor(q), f = fract(q);
  float s = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y));
    vec2 pt = g + h22(i + g) - f;
    float hh = h21(i + g + 7.7);
    if (hh > dens) continue;
    float b = pow(h21(i + g + 3.3), 6.0);
    s += (0.01 + 0.5*b)*exp(-dot(pt, pt)*(160.0 + 400.0*(1.0 - b)));
  }
  return s;
}
void main(){
  vec2 uv = (vUv - 0.5)*vec2(uAspect, 1.0);
  float s = stars(uv, 18.0, 0.55) + stars(uv + 3.1, 41.0, 0.5) + stars(uv + 9.7, 97.0, 0.45);
  vec3 col = vec3(0.35, 0.55, 1.0)*0.0006 + vec3(1.0, 0.95, 0.9)*s*0.12;
  float alpha = 65000.0;
  if (uBH > 0.5){
    float r = length(uv);
    if (r < 0.16){ col = vec3(0.0); alpha = 24.0; }
    else if (r < 0.2){ float k = smoothstep(0.2, 0.16, r); col = vec3(1.0, 0.7, 0.4)*(0.6 + 3.0*k)*0.08; alpha = 16.0; }
  }
  gl_FragColor = vec4(col, alpha);
}`,
});
const copyMat = new THREE.ShaderMaterial({
  vertexShader: vertQ, depthTest: false, depthWrite: false, uniforms: { tBG: { value: null }, uExp: { value: 1 } },
  fragmentShader: 'varying vec2 vUv; uniform sampler2D tBG; uniform float uExp; void main(){ gl_FragColor = vec4(texture2D(tBG, vUv).rgb*uExp, 1.0); }',
});
const toneMat = new THREE.ShaderMaterial({
  vertexShader: vertQ, depthTest: false, depthWrite: false, uniforms: { tIn: { value: null } },
  fragmentShader: `
varying vec2 vUv; uniform sampler2D tIn;
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec3 c = texture2D(tIn, vUv).rgb;
  float L0 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(L0), c, 1.08);
  float Lh = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
  float Lt = Lh*(1.0 + Lh/36.0)/(1.0 + Lh);
  vec3 hp = c*(Lt/Lh);
  hp = mix(hp, vec3(Lt), smoothstep(1.5, 12.0, Lh)*0.7);
  c = mix(aces(c), min(hp, vec3(1.0)), 0.5);
  c = max(c, 0.0);
  c = mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c));
  gl_FragColor = vec4(c, 1.0);
}`,
});
const mkScene = (mat) => { const s = new THREE.Scene(); const m = new THREE.Mesh(quadGeo, mat); m.frustumCulled = false; s.add(m); return s; };
const bgScene = mkScene(bgMat), copyScene = mkScene(copyMat), toneScene = mkScene(toneMat);

function resize() {
  const w = Math.max(64, Math.round(innerWidth * P.scale)), h = Math.max(48, Math.round(innerHeight * P.scale));
  W = w; H = h;
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  canvas.style.width = '100vw'; canvas.style.height = '100vh';
  const o = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  if (bhRT) { bhRT.dispose(); mainRT.dispose(); }
  bhRT = new THREE.WebGLRenderTarget(w, h, { ...o, depthBuffer: false });
  mainRT = new THREE.WebGLRenderTarget(w, h, { ...o, depthBuffer: true });
}
resize();
addEventListener('resize', () => { resize(); request(); });

// ── scene placement ──────────────────────────────────────────────────────────────────────────────────────────────────
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((c) => c / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const rel = { v: [0, 0, 1], d: 1 };            // direction body→ship and distance (M)
const distFromSlider = (s) => Math.exp(Math.log(30) + (Math.log(1.2) - Math.log(30)) * s);
let distR = 6;

function holdUnitVec() {
  const b = byId[P.body], t = ship.S[0];
  const c = worlds.debug.posAt(b, t);
  const sun = b.sheet > 0 ? unit(c.map((x) => -x)) : LIGHT.galaxyDir.slice();
  const side = unit(cross([0, 0, 1], sun)), up2 = cross(sun, side);
  const ph = P.phase * DEG, el = P.elev * DEG;
  let v = sun.map((s, i) => s * Math.cos(ph) + side[i] * Math.sin(ph));
  v = unit(v.map((x, i) => x * Math.cos(el) + up2[i] * Math.sin(el)));
  if (P.vdir) v = P.vdir.slice();
  return { c, v };
}
function setCoMoving(b, t) {   // 4-velocity of the body's frame (flat metric), so hold detection works
  const vb = worlds.debug.velAt(b, t), v2 = vb[0] * vb[0] + vb[1] * vb[1] + vb[2] * vb[2], g = 1 / Math.sqrt(1 - v2), S = ship.S;
  S[4] = g; S[5] = g * vb[0]; S[6] = g * vb[1]; S[7] = g * vb[2];
}
function place() {
  const b = byId[P.body], S = ship.S;
  ship.sheet = b.sheet; ship.universe = 0;
  const { c, v } = holdUnitVec();
  const d = distR * b.radius;
  const pos = c.map((x, i) => x + v[i] * d);
  S[1] = pos[0]; S[2] = pos[1]; S[3] = pos[2];
  const F = v.map((x) => -x), upRef = Math.abs(F[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1];
  const R = unit(cross(F, upRef)), U = cross(R, F);
  S.fill(0, 4); S[0] = S[0];
  S[4] = 1;
  S[9] = F[0]; S[10] = F[1]; S[11] = F[2]; S[13] = R[0]; S[14] = R[1]; S[15] = R[2]; S[17] = U[0]; S[18] = U[1]; S[19] = U[2];
  setCoMoving(b, S[0]);
  kerr.orthonormalize(S);
  rel.v = v; rel.d = d;
  ship.lock = null;
}
function holdPoint() {   // park at the standoff radius, co-moving, so the HUD offers LAND / DOCK
  const b = byId[P.body];
  distR = Math.max(1.2, (b.dockable ? b.standoff : b.standoff) / b.radius);
  if (b.dockable) distR = b.standoff / b.radius;
  place(); syncUI(); request();
}

// ── frame ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const camPos = new THREE.Vector3();
let camOverride = null;                     // { pos:[x,y,z], look:[x,y,z] } ship-space chase camera (for dock inspection)
let shipModel = null, nearScene = null, nearCam = null, nearKey = null;
async function loadShip() {
  const m = await import('../src/ship/model.js');
  shipModel = m.buildShip(ctx, { variant: 'orpheus' });
  ctx.shipModel = shipModel;
  nearScene = new THREE.Scene(); nearScene.add(shipModel.group);
  nearScene.add(new THREE.HemisphereLight(0x9aaacc, 0x181820, 0.7));
  nearKey = new THREE.DirectionalLight(0xfff2dd, 2.2); nearScene.add(nearKey, nearKey.target);
  nearCam = new THREE.PerspectiveCamera(P.fov, 1, 0.05, 2000);
  logMsg('orpheus model loaded for near pass');
}
if (Q.get('ship') === '1') loadShip().then(() => request()).catch((e) => console.error('ship load', e));
function frame() {
  const S = ship.S;
  ctx.view.exposure = P.exp;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -P.yaw * DEG, 0, 'YXZ'));
  if (camOverride) {
    camPos.set(...camOverride.pos);
    const m = new THREE.Matrix4().lookAt(camPos, new THREE.Vector3(...camOverride.look), new THREE.Vector3(0, 1, 0));
    q.setFromRotationMatrix(m);
  } else camPos.set(0, 0, 0);
  const cam = { quaternion: q, position: camPos, fov: P.fov, aspect: W / H, exposure: P.exp, bhTex: bhRT.texture, bhSize: [W, H], skip: null };
  bgMat.uniforms.uAspect.value = W / H; bgMat.uniforms.uBH.value = P.bh ? 1 : 0;
  renderer.setRenderTarget(bhRT); renderer.render(bgScene, orthoCam);
  copyMat.uniforms.tBG.value = bhRT.texture; copyMat.uniforms.uExp.value = P.exp;
  renderer.setRenderTarget(mainRT); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, false);
  renderer.render(copyScene, orthoCam);
  worlds.renderFar(renderer, cam);
  if (nearScene) {
    nearCam.fov = P.fov; nearCam.aspect = W / H; nearCam.position.copy(camPos); nearCam.quaternion.copy(q); nearCam.updateProjectionMatrix(); nearCam.updateMatrixWorld(true);
    const hs = worlds.debug.state.halcyon, sun = (hs && hs.sunShip) || [0.3, 0.8, 0.5];
    nearKey.position.set(sun[0] * 50, sun[1] * 50, sun[2] * 50); nearKey.target.position.set(0, 0, 0);
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(nearScene, nearCam); renderer.autoClear = true;
  }
  renderer.setRenderTarget(null);
  toneMat.uniforms.tIn.value = mainRT.texture;
  renderer.render(toneScene, orthoCam);
  info(cam);
}
function info(cam) {
  const st = worlds.debug.state[P.body], b = byId[P.body];
  const a = worlds.contextAction();
  $('action').textContent = a ? a.label : (ship.lock ? 'lock: ' + ship.lock.kind : '—');
  const lf = st.present ? worlds.debug.lightFor(b, st, P.exp) : null;
  $('info').textContent = [
    `${b.name}  ·  ${(st.dist / b.radius).toFixed(2)} R  ·  ${(st.dist * KM_PER_M).toFixed(0)} km  ·  alt ${((st.dist - b.radius) * KM_PER_M).toFixed(0)} km`,
    `t ${ship.S[0].toFixed(1)}  lag ${(st.lag || 0).toFixed(2)} s  ang radius ${st.angRad ? (st.angRad / DEG).toFixed(3) + '°' : '—'}  (${st.angRad ? (st.angRad / (2 * Math.tan(P.fov * DEG / 2) / H)).toFixed(1) : '—'} px)`,
    lf ? `white ${lf.white.toFixed(4)}  gain ${lf.k.toFixed(2)}  sun d ${st.dSun.toFixed(0)} M  phase cos ${st.phaseCos.toFixed(2)}` : '',
    `holding ${st.holding}  β ${st.betaRel ? st.betaRel.toExponential(1) : '0'}  lock ${ship.lock ? ship.lock.kind + ' p=' + (ship.lock.p || 0).toFixed(2) : '—'}`,
  ].join('\n');
}

let queued = false;
function request() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { frame(); } catch (e) { console.error(e); } window.__ready = true; window.__frames++; }); }

function stepSim(dt) {
  const S = ship.S, t = S[0] + dt;
  if (ship.lock) { worlds.lockState(ship.lock, t, S); }
  else {                                         // co-move with the body
    const b = byId[P.body];
    const c = worlds.debug.posAt(b, t);
    const { v } = holdUnitVec();
    S[0] = t; S[1] = c[0] + rel.v[0] * rel.d; S[2] = c[1] + rel.v[1] * rel.d; S[3] = c[2] + rel.v[2] * rel.d;
    setCoMoving(b, t); kerr.orthonormalize(S);
  }
  worlds.update(dt);
}
window.__step = (n = 1, dt = P.dt) => { for (let i = 0; i < n; i++) stepSim(dt); request(); };

// ── UI ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
for (const b of bodies) { const o = document.createElement('option'); o.value = b.id; o.textContent = `${b.name}${b.sheet < 0 ? ' (anti)' : ''}`; $('body').appendChild(o); }
const defaultDist = (b) => (b.kind === 'moon' ? 6 : b.kind === 'gasgiant' ? 6.5 : b.dockable ? 6 : 6);
distR = P.dist ?? defaultDist(byId[P.body]);
function sliderFromDist(d) { return (Math.log(30) - Math.log(Math.min(30, Math.max(1.2, d)))) / (Math.log(30) - Math.log(1.2)); }
function syncUI() {
  $('body').value = P.body; $('dist').value = sliderFromDist(distR); $('phase').value = P.phase; $('elev').value = P.elev; $('exp').value = P.exp; $('yaw').value = P.yaw; $('bh').checked = P.bh;
  $('distv').textContent = distR.toFixed(1) + ' R'; $('phasev').textContent = P.phase + '°'; $('elevv').textContent = P.elev + '°'; $('expv').textContent = P.exp.toFixed(1); $('yawv').textContent = P.yaw + '°';
}
$('body').onchange = (e) => { P.body = e.target.value; distR = defaultDist(byId[P.body]); place(); syncUI(); request(); };
$('dist').oninput = (e) => { distR = distFromSlider(+e.target.value); place(); syncUI(); request(); };
$('phase').oninput = (e) => { P.phase = +e.target.value; place(); syncUI(); request(); };
$('elev').oninput = (e) => { P.elev = +e.target.value; place(); syncUI(); request(); };
$('exp').oninput = (e) => { P.exp = +e.target.value; syncUI(); request(); };
$('yaw').oninput = (e) => { P.yaw = +e.target.value; syncUI(); request(); };
$('bh').onchange = (e) => { P.bh = e.target.checked; request(); };
$('render').onclick = () => request();
$('clean').onclick = () => document.body.classList.toggle('clean');
$('hold').onclick = () => holdPoint();
$('act').onclick = () => { const a = worlds.contextAction(); if (a) { logMsg('run ' + a.label); a.run(); loopOn(); } };
$('site').onclick = () => { const s = worlds.cycleSite(); logMsg('site → ' + (s ? s.name : 'none')); request(); };
$('step').onclick = () => window.__step(1, 0.5);
let auto = P.auto;
$('auto').onclick = () => { auto = !auto; $('auto').textContent = 'auto: ' + (auto ? 'on' : 'off'); if (auto) loopOn(); };
let looping = false;
function loopOn() {
  if (looping) return; looping = true;
  const tick = () => {
    if (!(auto || ship.lock || worlds.busy)) { looping = false; request(); return; }
    stepSim(P.dt); frame(); window.__ready = true; window.__frames++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
ship.S[0] = P.t;
place(); syncUI(); request();
if (auto) loopOn();

// scripted control for headless screenshots: __set({ body, dist, phase, elev, exp, yaw, bh, t, fov }) re-places and renders
window.__frames = 0;
window.__set = (o = {}) => {
  for (const k of ['phase', 'elev', 'exp', 'yaw', 't', 'fov']) if (o[k] !== undefined) P[k] = +o[k];
  if (o.bh !== undefined) P.bh = !!o.bh;
  if (o.body !== undefined) { P.body = o.body; if (o.dist === undefined) distR = defaultDist(byId[P.body]); }
  if (o.dist !== undefined) distR = +o.dist;
  if (o.t !== undefined) ship.S[0] = P.t;
  place(); syncUI(); request();
};
window.__wait = () => new Promise((res) => { const f0 = window.__frames; const iv = setInterval(() => { if (window.__frames > f0) { clearInterval(iv); res(window.__frames); } }, 50); });
window.__uni = (name, arr) => { const m = worlds.debug.gl.mats[P.body]; if (!m || !m.uniforms[name]) return false; const v = m.uniforms[name].value; if (v.set) v.set(...arr); else m.uniforms[name].value = arr; request(); return true; };
window.__vdir = (v) => { P.vdir = v ? unit(v) : null; place(); request(); };
window.__cam = (o) => { camOverride = o ? { pos: o.pos, look: o.look } : null; request(); };
