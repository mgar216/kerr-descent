// ═══════════════════════════════════════════════════════════════════════════
//  ORPHEUS / EURYDICE — ship model (exterior + walkable interior).   export function buildShip(ctx, { variant })
//  Assembly only: geometry lives in parts/*.js (each exports `default function(kit)`), shared infrastructure in parts/kit.js.
//  Safe to call more than once (no module singletons except immutable texture caches).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { createKit } from './parts/kit.js';
import * as L from './parts/layout.js';
import structure from './parts/structure.js';
import canopy from './parts/canopy.js';
import hull from './parts/hull.js';
import fixtures from './parts/fixtures.js';
import drive from './parts/drive.js';
import gear from './parts/gear.js';
import flightdeck from './parts/flightdeck.js';
import crew from './parts/crew.js';
import science from './parts/science.js';
import dome from './parts/dome.js';
import cargo from './parts/cargo.js';
import engineering from './parts/engineering.js';
import derelict from './parts/derelict.js';

const V3 = THREE.Vector3;
const PARTS = [['structure', structure], ['canopy', canopy], ['hull', hull], ['fixtures', fixtures], ['drive', drive], ['gear', gear],
  ['flightdeck', flightdeck], ['crew', crew], ['science', science], ['dome', dome], ['cargo', cargo], ['engineering', engineering], ['derelict', derelict]];

const EUR_IDS = new Set(['seat.pilot', 'seat.systems', 'airlock.panel']);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function selectParts(only) { return PARTS.filter(([name]) => !only || name === 'structure' || name === 'canopy' || only.includes(name)); }
function runPart(kit, name, fn, errors) {
  try { fn(kit); } catch (e) { errors.push(`${name}: ${e && e.message}`); console.error(`[ship:${kit.variant}] part "${name}" failed`, e); }
}

// Synchronous build (blocks ~1–2 s the first time: textures are generated once and cached). `only` = array of part names (dev harness).
export function buildShip(ctx, { variant = 'orpheus', landed = false, only = null } = {}) {
  const kit = createKit(ctx, variant), errors = [];
  kit.state.landed = !!landed;                      // parts read kit.state.landed / rampWant / thrust / mode in their onUpdate callbacks
  for (const [name, fn] of selectParts(only)) runPart(kit, name, fn, errors);
  return assemble(ctx, kit, variant, landed, errors);
}
// Async build: yields to the event loop between parts so a loading screen can animate. onProgress(0..1, partName)
export async function buildShipAsync(ctx, { variant = 'orpheus', landed = false, only = null } = {}, onProgress) {
  const kit = createKit(ctx, variant), errors = [], list = selectParts(only);
  kit.state.landed = !!landed;
  for (let i = 0; i < list.length; i++) {
    if (onProgress) onProgress(i / list.length, list[i][0]);
    await new Promise((r) => setTimeout(r, 0));
    runPart(kit, list[i][0], list[i][1], errors);
  }
  await new Promise((r) => setTimeout(r, 0));
  if (onProgress) onProgress(1, 'finalize');
  return assemble(ctx, kit, variant, landed, errors);
}

function assemble(ctx, kit, variant, landed, errors) {
  const eur = variant === 'eurydice';
  const root = kit.finalize();
  const world = kit.world, state = kit.state;
  state.landed = !!landed; state.mode = eur ? 'emergency' : 'normal';

  // ───────── interior light pool (≤ 6 real PointLights, no shadows) ─────────
  const POOL = 6, R_LIGHT = 9.5, I0 = 9.0;
  const lights = [];
  for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffffff, 0, 10.5, 2); l.castShadow = false; l.name = `shipLight${i}`; root.add(l); lights.push(l); }
  const sites = kit.lightSites, _scratch = new Array(sites.length);
  const tmpC = new THREE.Color();

  const modeTint = { normal: null, alert: new THREE.Color(1, 0.14, 0.1), emergency: new THREE.Color(1, 0.34, 0.1), off: null };
  function updateLights(t) {
    const cam = state.cam; let n = 0;
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i], d = cam.distanceTo(s.pos), w = Math.max(0, 1 - d / R_LIGHT);
      _scratch[n++] = { s, w: w * w * s.k };
    }
    _scratch.length = n; _scratch.sort((a, b) => b.w - a.w);
    const mode = state.mode;
    let f = 1; if (mode === 'alert') f = 0.7 * (0.35 + 0.65 * state.pulse); else if (mode === 'emergency') f = 0.24 * state.flicker; else if (mode === 'off') f = 0;
    for (let i = 0; i < POOL; i++) {
      const l = lights[i], e = _scratch[i];
      if (!e || e.w <= 0.0005 || f === 0) { l.intensity = 0; continue; }
      l.position.copy(e.s.pos);
      const tint = modeTint[mode];
      if (tint) l.color.copy(tint); else l.color.copy(e.s.color);
      l.intensity = I0 * e.w * f;
    }
  }

  // ───────── emissive groups & LEDs ─────────
  function updateEmitters(t) {
    const mode = state.mode, pulse = state.pulse, fl = state.flicker;
    const fm = { main: 1, accent: 1, status: 1 };
    let tintM = null, tintA = null;
    if (mode === 'alert') { fm.main = 0.45 + 0.55 * pulse; fm.accent = 0.45 + 0.55 * pulse; tintM = tintA = modeTint.alert; }
    else if (mode === 'emergency') { fm.main = 0.1 * fl; fm.accent = 0.22 * fl; fm.status = 0.85; tintM = tintA = modeTint.emergency; }
    else if (mode === 'off') { fm.main = 0; fm.accent = 0; fm.status = 0.3; }
    for (const [g, tint] of [['main', tintM], ['accent', tintA], ['status', null]]) {
      for (const m of kit.emitters[g]) {
        const u = m.userData; if (u.led != null) continue;
        const b = u.base, k = u.intensity * fm[g];
        if (tint) m.color.setRGB(tint.r * k, tint.g * k, tint.b * k); else m.color.setRGB(b.r * k, b.g * k, b.b * k);
      }
    }
    for (const m of kit.leds) {
      const u = m.userData, b = u.base; let on = 1;
      if (u.led === 'Blink') on = Math.sin(t * 6.283 * 0.9) > 0 ? 1 : 0.06;
      else if (u.led === 'Fast') on = Math.sin(t * 6.283 * 3.1) > 0 ? 1 : 0.06;
      else if (u.led === 'Rand') on = hash(Math.floor(t * 9)) > 0.45 ? 1 : 0.08;
      const k = u.intensity * fm.status * on;
      m.color.setRGB(b.r * k, b.g * k, b.b * k);
    }
  }

  // ───────── doors ─────────
  const doorNear = 1.6;
  function updateDoors(dt) {
    const p = state.player;
    for (const d of kit.doors) {
      if (d.stuck != null) continue;
      let want = d.forceOpen ? 1 : 0;
      if (p && !d.locked) { const dx = p.x - d.pos.x, dz = p.z - d.pos.z; if (Math.hypot(dx, dz) < doorNear && Math.abs(p.y - d.pos.y) < 3.2) want = 1; }
      if (d.open === want) continue;
      const step = dt / d.time; d.open = want > d.open ? Math.min(want, d.open + step) : Math.max(want, d.open - step);
      d.apply(d.open);
    }
  }

  // ───────── screens ─────────
  function updateScreens(t) {
    const cam = state.cam;
    for (const s of kit.screens) {
      const dist = s.mesh.getWorldPosition(_wp).distanceTo(cam);
      s.mesh.visible = dist < s.range * 1.3;                         // far screens are not drawn at all
      if (!s.draw || t - s._t < s.interval || dist > s.range) continue;
      s._t = t; s.draw(s.ctx2d, s.canvas.width, s.canvas.height, t); s.tex.needsUpdate = true;
    }
  }
  const _wp = new V3();

  // exterior-only dynamic parts (legs, ladder, bay doors, plume, dish, glow sprites) are skipped while the viewer is inside the hull
  const extOnly = [];
  for (const o of root.children) {
    if (o.isSprite || /^(gear\.(strut|piston|pad|link|ladder|door)|drive\.|dish)/.test(o.name)) extOnly.push(o);
  }
  const intMeshes = root.children.filter((o) => (o.isMesh || o.isInstancedMesh) && !/\.ext$|^(decal|screen|signs|scorch|glow)/.test(o.name) && !/^(gear|drive)/.test(o.name));
  let wasInside = null, wasFar = null;
  function updateInside() {
    const c = state.cam, inside = Math.abs(c.x) < 3.95 && c.y > -1.45 && c.y < 1.6 && c.z > -0.9 && c.z < 38.4;
    const far = !inside && Math.hypot(c.x, c.y, c.z - 18) > 80;           // far chase view: the interior is invisible behind the hull
    if (inside !== wasInside) { wasInside = inside; for (const o of extOnly) o.visible = !inside; }
    if (far !== wasFar) { wasFar = far; for (const o of intMeshes) o.visible = !far; }
  }

  // ───────── API ─────────
  const interactables = kit.interactables.filter((i) => !eur || EUR_IDS.has(i.id) || i.id.startsWith('eur.'));
  const rooms = L.ROOMS.map((r) => ({ id: r.id, name: eur && r.id === 'core' ? 'Dead Core' : r.name, min: [...r.min], max: [...r.max] }));
  const space = {
    id: variant, name: eur ? 'EURYDICE' : 'ORPHEUS', group: root, gravity: 9.81,
    spawn: { pos: [...L.SEATS.pilot.stand], yaw: L.SEATS.pilot.yaw },
    floorAt: (x, z, yFeet) => world.floorAt(x, z, yFeet),
    collide: (p, radius, height) => world.collide(p, radius, height),
    interactables, rooms,
    footstep: (pos) => world.footstepAt(pos.x, pos.z, pos.y),
    colliders: world.colliders, floors: world.floors,
  };
  const bounds = new THREE.Box3(new V3(-7.5, L.GROUND_Y, L.SHIP_Z0), new V3(7.5, 4.4, L.SHIP_Z1 + 0.3));   // incl. radiator wings (plume excluded)
  const api = {
    group: root, variant, space,
    hull: { colliders: kit.hullColliders, bounds },
    screens: kit.screens,
    seats: { pilot: { eye: [0, 0, 0], stand: [...L.SEATS.pilot.stand], yaw: L.SEATS.pilot.yaw }, systems: { eye: [...L.SEATS.systems.eye], stand: [...L.SEATS.systems.stand], yaw: L.SEATS.systems.yaw } },
    airlock: { inner: [...L.AIRLOCK.inner], outer: [...L.AIRLOCK.outer], evaExit: [...L.AIRLOCK.evaExit], dock: { pos: [...L.AIRLOCK.dock.pos], normal: [...L.AIRLOCK.dock.normal] } },
    landing: { groundY: L.GROUND_Y, rampFoot: [0, L.GROUND_Y, L.RAMP.zFoot], rampTop: [0, L.RAMP.yTop, L.RAMP.zTop] },
    rooms,
    doors: kit.doors,
    errors,
    get lightMode() { return state.mode; },
    get landed() { return state.landed; },
    get rampOpen() { return state.rampOpen > 0.5; },
    interiorLights(mode) { state.mode = (mode === 'alert' || mode === 'emergency' || mode === 'off') ? mode : 'normal'; },
    setLanded(b) { state.landed = !!b; },
    setRamp(open) { state.rampWant = open ? 1 : 0; },
    setHatch(open) { state.hatchWant = open ? 1 : 0; },
    get hatchOpen() { return state.hatchOpen > 0.5; },
    setThrust(level, boost = 0) { state.thrust = Math.max(0, Math.min(1, +level || 0)); state.boost = Math.max(0, Math.min(1, +boost || 0)); },
    update(dt, t, playerPos) {
      if (!root.visible) return;
      state.dt = dt; state.t = t; state.player = playerPos || null;
      const near = ctx.cameras && ctx.cameras.near;
      if (near) state.cam.copy(near.position); else if (playerPos) state.cam.set(playerPos.x, playerPos.y + 1.6, playerPos.z); else state.cam.set(0, 0, 0);
      state.pulse = 0.5 + 0.5 * Math.sin(t * 6.4);
      const n1 = hash(Math.floor(t * 14)), n2 = hash(Math.floor(t * 3.3) + 91);
      state.flicker = eur ? (n2 > 0.82 ? 0.15 : 0.62 + 0.38 * n1) : 1;
      updateDoors(dt); updateLights(t); updateEmitters(t); updateScreens(t); updateInside();
      for (const fn of kit.updaters) fn(dt, t, state);
    },
  };
  // initial state: apply one update-free pass so lights/emissives are right on the first frame
  state.cam.set(0, 0, 0); state.pulse = 0.5; state.flicker = eur ? 0.7 : 1; updateLights(0); updateEmitters(0);
  api.kit = kit;
  api.dispose = () => {                                        // free GPU resources of this instance (shared texture cache is kept)
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const [, m] of kit.allMats()) m.dispose();
    if (kit.solidMats) for (const m of kit.solidMats) m.dispose();
    for (const s of kit.screens) { s.tex.dispose(); s.mat.dispose(); }
    for (const l of lights) l.dispose && l.dispose();
    if (kit.hullDepth) kit.hullDepth.dispose();
  };
  return api;
}

export default buildShip;
