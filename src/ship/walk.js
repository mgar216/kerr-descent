// ORPHEUS on-foot + EVA controller.
//
//   makeBoxSpace(cfg)      → WalkSpace (DESIGN §3.3) from AABB colliders + flat/ramped floor rectangles
//   createWalkMode(ctx)    → Mode 'walk'  (WASD / mouse-look / jump / crouch / interact / flashlight / seat transitions)
//   createEvaMode(ctx)     → Mode 'eva'   (zero-g suit thrusters, 60 m tether, hull collision, helmet overlay)
//
// Space conventions (ship space): metres, +X starboard, +Y up, −Z forward. yaw is three.js rotation.y (Euler YXZ):
// yaw 0 looks down −Z, yaw > 0 turns LEFT; forward = (−sin yaw, 0, −cos yaw), right = (cos yaw, 0, −sin yaw).
import * as THREE from 'three';
import { createFoley } from '../audio/foley.js';

const V3 = THREE.Vector3, Q4 = THREE.Quaternion, EUL = THREE.Euler;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrapPi = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const arr3 = (v) => (Array.isArray(v) || ArrayBuffer.isView(v) ? v : [v.x, v.y, v.z]);
const toV3 = (v) => (v && v.isVector3 ? v : new V3(v[0], v[1], v[2]));
const isVec = (v) => v && typeof v.x === 'number';

export const WALK = {
  STAND_H: 1.75, CROUCH_H: 1.2, RADIUS: 0.3, EYE_DROP: 0.09, // eye = height − 0.09 → 1.66 m standing, 1.11 m crouched
  STEP: 0.45, SKIN: 0.05, WALK: 1.4, SPRINT: 3.2, CROUCH: 0.9, REACH: 2.2,
};
const { STAND_H, CROUCH_H, RADIUS, EYE_DROP, STEP, SKIN, REACH } = WALK;

// ───────────────────────────────────────── BoxSpace ─────────────────────────────────────────
function segBox(a, b, mn, mx) {
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-9) { if (a[i] < mn[i] || a[i] > mx[i]) return false; continue; }
    let s = (mn[i] - a[i]) / d, e = (mx[i] - a[i]) / d;
    if (s > e) { const t = s; s = e; e = t; }
    if (s > t0) t0 = s;
    if (e < t1) t1 = e;
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * Axis-aligned-box WalkSpace.
 *   colliders: [{ min:[x,y,z], max:[x,y,z], door?:id|true, enabled?:()=>bool, stand?:bool }]
 *     – blocks the capsule when its y-range overlaps [feet+0.05, feet+height]; low (≤ 0.45 m, ≥ 0.45 m wide) or `stand:true`
 *       boxes whose top is within step height are stepped ON instead of blocking. `door` colliders are open when
 *       space.setDoor(id, true) was called; `enabled()` false disables any collider (e.g. an open door).
 *   floors: [{ min:[x,z], max:[x,z], y, mat? } | { min, max, y0, y1, axis:'x'|'z', mat? }]  (ramp: y0 at min[axis] → y1 at max[axis])
 */
export function makeBoxSpace(cfg = {}) {
  const doorOpen = new Map();
  let seq = 0;
  const normCollider = (c) => {
    const min = arr3(c.min), max = arr3(c.max), w = max[0] - min[0], d = max[2] - min[2], h = max[1] - min[1];
    return {
      min, max, enabled: c.enabled || null, door: c.door ? (c.door === true ? 'door#' + seq++ : String(c.door)) : null,
      stand: c.stand !== undefined ? !!c.stand : h <= STEP && w >= 0.45 && d >= 0.45, src: c,
    };
  };
  const normFloor = (f) => {
    const a = arr3(f.min), b = arr3(f.max), x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
    const flat = f.y !== undefined;
    return { x0, x1, z0, z1, flat, y0: flat ? f.y : f.y0, y1: flat ? f.y : f.y1, axis: f.axis === 'x' ? 0 : 1, mat: f.mat || null, enabled: f.enabled || null };
  };
  const floorY = (f, x, z) => (f.flat ? f.y0 : f.y0 + (f.y1 - f.y0) * clamp((f.axis === 0 ? (x - f.x0) / Math.max(1e-6, f.x1 - f.x0) : (z - f.z0) / Math.max(1e-6, f.z1 - f.z0)), 0, 1));

  const cols = (cfg.colliders || []).map(normCollider);
  const floors = (cfg.floors || []).map(normFloor);
  const active = (c) => (!c.door || !doorOpen.get(c.door)) && (!c.enabled || c.enabled());
  const spawnPos = cfg.spawn && cfg.spawn.pos ? arr3(cfg.spawn.pos) : [0, 0, 0];

  const interactables = cfg.interactables || [];
  for (const it of interactables) { if (it.pos && !it.pos.isVector3) it.pos = toV3(arr3(it.pos)); if (it.radius == null) it.radius = 1; }

  const baseFoot = cfg.footstep || 'metal';
  const anyMat = floors.some((f) => f.mat);
  const floorUnder = (x, z, y) => {
    let best = null, bh = -Infinity;
    for (const f of floors) {
      if (x < f.x0 - 1e-6 || x > f.x1 + 1e-6 || z < f.z0 - 1e-6 || z > f.z1 + 1e-6 || (f.enabled && !f.enabled())) continue;
      const h = floorY(f, x, z);
      if (h <= y + STEP + 1e-3 && h > bh) { bh = h; best = f; }
    }
    return best;
  };

  const space = {
    id: cfg.id || 'space', name: cfg.name || cfg.id || 'space', group: cfg.group || null,
    gravity: cfg.gravity == null ? 9.81 : cfg.gravity,
    spawn: { pos: spawnPos, yaw: (cfg.spawn && cfg.spawn.yaw) || 0 },
    interactables, rooms: cfg.rooms || [], colliders: cols, floors,
    update: cfg.update || null,

    // Highest walkable surface at (x,z) that is no more than STEP above yFeet (it may be any distance below: drop). null = none.
    floorAt(x, z, yFeet) {
      const lim = yFeet + STEP + 1e-4;
      let best = -Infinity;
      for (let i = 0; i < floors.length; i++) {
        const f = floors[i];
        if (x < f.x0 - 1e-6 || x > f.x1 + 1e-6 || z < f.z0 - 1e-6 || z > f.z1 + 1e-6) continue;
        if (f.enabled && !f.enabled()) continue;
        const h = floorY(f, x, z);
        if (h <= lim && h > best) best = h;
      }
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        if (!c.stand || x < c.min[0] || x > c.max[0] || z < c.min[2] || z > c.max[2]) continue;
        const h = c.max[1];
        if (h <= lim && h > best && active(c)) best = h;
      }
      return best === -Infinity ? null : best;
    },

    // Cylinder-vs-AABB push-out (XZ only, feet vector mutated). Three relaxation passes so corners and parallel walls resolve.
    collide(p, r, h) {
      for (let it = 0; it < 3; it++) {
        let moved = false;
        for (let i = 0; i < cols.length; i++) {
          const c = cols[i], mn = c.min, mx = c.max;
          if (mx[1] <= p.y + SKIN || mn[1] >= p.y + h - 0.02) continue;            // no vertical overlap
          if (c.stand && mx[1] - p.y <= STEP + 1e-4) continue;                      // a step: floorAt lifts us onto it
          if (!active(c)) continue;
          const qx = clamp(p.x, mn[0], mx[0]), qz = clamp(p.z, mn[2], mx[2]), dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
          else { // centre inside the box → leave through the nearest face
            const l = p.x - mn[0], rr = mx[0] - p.x, f = p.z - mn[2], bk = mx[2] - p.z, m = Math.min(l, rr, f, bk);
            if (m === l) p.x = mn[0] - r; else if (m === rr) p.x = mx[0] + r; else if (m === f) p.z = mn[2] - r; else p.z = mx[2] + r;
          }
          moved = true;
        }
        if (!moved) break;
      }
    },

    // Lowest obstruction bottom (y) above a head of height h standing on yFeet; Infinity when clear.
    ceilingAt(x, z, yFeet, h, r) {
      const yHead = yFeet + h;
      let best = Infinity;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        if (c.min[1] < yHead - 0.02 || c.min[1] >= best || !active(c)) continue;
        const dx = clamp(x, c.min[0], c.max[0]) - x, dz = clamp(z, c.min[2], c.max[2]) - z;
        if (dx * dx + dz * dz < r * r) best = c.min[1];
      }
      return best;
    },

    // Line of sight a→b blocked by a collider? Colliders around `ignorePos` (the thing being looked at) are ignored.
    blocked(a, b, ignorePos) {
      const A = arr3(a), B = arr3(b), ip = ignorePos ? arr3(ignorePos) : null;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        if (!active(c)) continue;
        if (ip && ip[0] >= c.min[0] - 0.2 && ip[0] <= c.max[0] + 0.2 && ip[1] >= c.min[1] - 0.2 && ip[1] <= c.max[1] + 0.2 && ip[2] >= c.min[2] - 0.2 && ip[2] <= c.max[2] + 0.2) continue;
        if (segBox(A, B, c.min, c.max)) return true;
      }
      return false;
    },

    floorMaterial(x, z, y) { const f = floorUnder(x, z, y); return f && f.mat; },
    footDefault: baseFoot, // material string or fn(pos) used where a floor has no `mat` (mutable: e.g. space.footDefault = 'ice')
    footstep(pos) { if (anyMat) { const f = floorUnder(pos.x, pos.z, pos.y); if (f && f.mat) return f.mat; } const b = space.footDefault; return typeof b === 'function' ? b(pos) : b; },

    setDoor(id, open) { open = !!open; if (doorOpen.get(id) === open) return; doorOpen.set(id, open); if (cfg.onDoor) cfg.onDoor(id, open); },
    isDoorOpen(id) { return !!doorOpen.get(id); },
    toggleDoor(id) { space.setDoor(id, !doorOpen.get(id)); return !!doorOpen.get(id); },
    addCollider(c) { const n = normCollider(c); cols.push(n); return n; },
    removeCollider(n) { const i = cols.indexOf(n); if (i >= 0) cols.splice(i, 1); },
    addFloor(f) { const n = normFloor(f); floors.push(n); return n; },
    getInteractable(id) { return interactables.find((i) => i.id === id) || null; },
  };
  return space;
}

// ──────────────────────────────── shared flashlight (one SpotLight for walk + EVA) ────────────────────────────────
const rigs = new WeakMap();
function getRig(ctx) {
  let rig = rigs.get(ctx);
  if (rig) return rig;
  const group = new THREE.Group();
  group.name = 'orpheus-flashlight';
  // absolute intensity (candela) ≈ 8: ~0.38 linear radiance on a mid-grey wall at 2 m. Intensity 0 when off — the light stays in the
  // scene so toggling never changes the light count (no shader recompiles).
  const light = new THREE.SpotLight(0xfff0d8, 0, 40, THREE.MathUtils.degToRad(30), 0.7, 2);
  light.position.set(0.13, -0.11, 0.02);
  light.castShadow = false;
  const target = new THREE.Object3D();
  target.position.set(0, -0.06, -8);
  group.add(light, target);
  light.target = target;
  if (ctx.scenes && ctx.scenes.near) ctx.scenes.near.add(group);
  rig = { group, light, on: false, level: 0, aim: new Q4(), aimInit: false, owner: null };
  rigs.set(ctx, rig);
  return rig;
}
function rigUpdate(rig, pos, quat, dt, active) {
  const on = rig.on && active;
  rig.level = damp(rig.level, on ? 1 : 0, on ? 30 : 20, dt);
  rig.light.intensity = rig.level < 0.002 ? 0 : 8 * rig.level;
  rig.group.position.copy(pos);
  if (!rig.aimInit) { rig.aim.copy(quat); rig.aimInit = true; } else rig.aim.slerp(quat, 1 - Math.exp(-18 * dt)); // hand-held lag
  rig.group.quaternion.copy(rig.aim);
}
function rigOff(rig) { rig.level = 0; rig.light.intensity = 0; rig.aimInit = false; }

// Generic line-of-sight test for WalkSpaces that expose `colliders` but no `blocked()`. Understands {min,max} AABBs (+enabled/door) and the
// {kind:'box'|'cyl', cx,cz,hx,hz,r,y0,y1,c,s,door,open,off} shape of the ship's WalkWorld. `ign` = the point being looked at: colliders around it are skipped.
function losBlocked(cols, a, b, ign) {
  const A = [a.x, a.y, a.z], B = [b.x, b.y, b.z];
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (!c || c.off || (c.door && c.open > 0.5) || (c.enabled && !c.enabled())) continue;
    if (c.min && c.max) {
      const mn = arr3(c.min), mx = arr3(c.max);
      if (ign && ign.x >= mn[0] - 0.2 && ign.x <= mx[0] + 0.2 && ign.y >= mn[1] - 0.2 && ign.y <= mx[1] + 0.2 && ign.z >= mn[2] - 0.2 && ign.z <= mx[2] + 0.2) continue;
      if (segBox(A, B, mn, mx)) return true;
    } else if (c.kind === 'box') {
      const loc = (x, z) => [c.c * (x - c.cx) - c.s * (z - c.cz), c.s * (x - c.cx) + c.c * (z - c.cz)];
      const la = loc(a.x, a.z), lb = loc(b.x, b.z);
      if (ign) { const li = loc(ign.x, ign.z); if (Math.abs(li[0]) <= c.hx + 0.2 && Math.abs(li[1]) <= c.hz + 0.2 && ign.y >= c.y0 - 0.2 && ign.y <= c.y1 + 0.2) continue; }
      if (segBox([la[0], a.y, la[1]], [lb[0], b.y, lb[1]], [-c.hx, c.y0, -c.hz], [c.hx, c.y1, c.hz])) return true;
    } else if (c.kind === 'cyl') {
      if (ign && Math.hypot(ign.x - c.cx, ign.z - c.cz) <= c.r + 0.2 && ign.y >= c.y0 - 0.2 && ign.y <= c.y1 + 0.2) continue;
      const dx = B[0] - A[0], dz = B[2] - A[2], fx = A[0] - c.cx, fz = A[2] - c.cz, qa = dx * dx + dz * dz, qb = 2 * (fx * dx + fz * dz), qc = fx * fx + fz * fz - c.r * c.r;
      let t0 = 0, t1 = 1;
      if (qa < 1e-9) { if (qc > 0) continue; }
      else { const disc = qb * qb - 4 * qa * qc; if (disc < 0) continue; const sq = Math.sqrt(disc); t0 = Math.max(0, (-qb - sq) / (2 * qa)); t1 = Math.min(1, (-qb + sq) / (2 * qa)); if (t0 > t1) continue; }
      const y0 = A[1] + t0 * (B[1] - A[1]), y1 = A[1] + t1 * (B[1] - A[1]);
      if (Math.max(y0, y1) >= c.y0 && Math.min(y0, y1) <= c.y1) return true;
    }
  }
  return false;
}
// ───────────────────────────────────── interaction targeting ─────────────────────────────────────
function createInteractor(ctx, keyLabel, opts = {}) {
  const ray = new THREE.Raycaster(), tA = new V3();
  if (ctx.cameras && ctx.cameras.near) ray.camera = ctx.cameras.near;
  let best = null, shown;
  const posOf = (it) => { if (!it.pos || !it.pos.isVector3) it.pos = toV3(arr3(it.pos || [0, 0, 0])); return it.pos; };
  const visibleChain = (o) => { for (; o; o = o.parent) if (o.visible === false) return false; return true; };
  const labelOf = (it) => { try { return typeof it.label === 'function' ? it.label() : it.label; } catch (e) { return ''; } };
  const occluded = (space, a, b, ign) => !!(space && (space.blocked ? space.blocked(a, b, ign) : space.colliders ? losBlocked(space.colliders, a, b, ign) : false));
  return {
    get best() { return best; },
    scan(eye, fwd, list, space) {
      let nb = null, ns = Infinity;
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        if (!it) continue;
        try { if (it.enabled && !it.enabled()) continue; } catch (e) { continue; }
        const p = posOf(it), rad = it.radius == null ? 1 : it.radius, dEye = p.distanceTo(eye), dSurf = Math.max(0, dEye - rad);
        if (dSurf > REACH + 0.6) continue;
        let s = Infinity;
        if (it.object && visibleChain(it.object)) { // 1. ray from the eye against the object's meshes
          ray.set(eye, fwd); ray.near = 0; ray.far = REACH;
          const hits = ray.intersectObject(it.object, true);
          for (let h = 0; h < hits.length; h++) if (visibleChain(hits[h].object)) { if (!occluded(space, eye, hits[h].point, p)) s = 0.1 * hits[h].distance - 0.6; break; }
        }
        if (s === Infinity && dSurf <= REACH) { // 2. proximity + view-cone fallback on pos/radius
          tA.subVectors(p, eye);
          const len = Math.max(tA.length(), 1e-4), ang = Math.acos(clamp(tA.dot(fwd) / len, -1, 1)), cone = Math.min(1.2, 0.5 + Math.atan2(rad, Math.max(len, 0.3)));
          if ((opts.omni || ang <= cone) && !occluded(space, eye, p, p)) s = (opts.omni ? 0.1 * ang : ang) + 0.35 * dSurf; // closer + more centred wins
        }
        if (it === best && s < Infinity) s -= 0.08; // hysteresis
        if (s < ns) { ns = s; nb = it; }
      }
      best = nb;
      const lab = nb ? labelOf(nb) : null;
      const html = nb ? `<kbd>${keyLabel}</kbd> ${lab || 'INTERACT'}` : null;
      if (html !== shown) { shown = html; if (ctx.ui && ctx.ui.prompt) ctx.ui.prompt(html); }
    },
    clear() { best = null; if (shown !== null && shown !== undefined) { shown = null; if (ctx.ui && ctx.ui.prompt) ctx.ui.prompt(null); } else shown = null; },
  };
}

// ─────────────────────────────────────────── walk mode ───────────────────────────────────────────
export function createWalkMode(ctx) {
  const foley = createFoley(ctx), rig = getRig(ctx), I = createInteractor(ctx, 'E');
  const keys = ctx.input && ctx.input.keys ? ctx.input.keys : new Set();
  const S = {
    active: false, space: null, seat: null, trans: null, time: 0,
    feet: new V3(), vel: new V3(), yaw: 0, pitch: 0, height: STAND_H, grounded: true, sprinting: false,
    stepOff: 0, bobPhase: 0, bobAmp: 0, roll: 0, landDip: 0, landVel: 0, fovKick: 0,
    jumpBuf: 0, coyote: 0, scanT: 0, room: null, safe: new V3(), eye: new V3(), floating: false, stuckT: 0,
  };
  const pose = { position: new V3(), quaternion: new Q4(), fov: 75 };
  const eul = new EUL(0, 0, 0, 'YXZ'), tmp = new V3(), fwdV = new V3(), eyeV = new V3();
  let reticle = null, reticleKey = -1;

  const surface = () => { const fs = S.space && S.space.footstep; const m = typeof fs === 'function' ? fs(S.feet) : fs; return m || 'metal'; };
  const gravity = () => (S.space && S.space.gravity != null ? S.space.gravity : 9.81);
  const canStand = () => { const sp = S.space; return !sp.ceilingAt || sp.ceilingAt(S.feet.x, S.feet.z, S.feet.y, CROUCH_H, RADIUS) >= S.feet.y + STAND_H; };
  const jumpSpeed = (g) => Math.min(3.3, Math.sqrt(2 * g * 4.0)); // 0.55 m at 1 g; capped to a 4 m apex in very low gravity

  function ensureReticle() {
    if (reticle || typeof document === 'undefined') return;
    reticle = document.createElement('div');
    reticle.className = 'orpheus-reticle';
    reticle.style.cssText = 'position:fixed;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:rgba(200,245,255,.6);box-shadow:0 0 6px rgba(134,236,255,.7);pointer-events:none;z-index:3;transition:width .12s,height .12s,margin .12s,background .12s,border-color .12s;border:0 solid rgba(134,236,255,.9);box-sizing:border-box;display:none';
    document.body.appendChild(reticle);
  }
  function setReticle(show, hot) {
    ensureReticle();
    if (!reticle) return;
    const vis = !!(show && mode.reticle), key = vis ? (hot ? 2 : 1) : 0;
    if (key === reticleKey) return;
    reticleKey = key;
    reticle.style.display = vis ? 'block' : 'none';
    if (hot) { reticle.style.width = reticle.style.height = '18px'; reticle.style.margin = '-9px 0 0 -9px'; reticle.style.background = 'rgba(134,236,255,.08)'; reticle.style.borderWidth = '1.5px'; }
    else { reticle.style.width = reticle.style.height = '4px'; reticle.style.margin = '-2px 0 0 -2px'; reticle.style.background = 'rgba(200,245,255,.6)'; reticle.style.borderWidth = '0'; }
  }

  function place(pos, yaw, pitch) {
    const p = arr3(pos);
    S.feet.set(p[0], p[1], p[2]); S.vel.set(0, 0, 0); S.yaw = yaw || 0; S.pitch = pitch || 0;
    S.height = STAND_H; S.stepOff = 0; S.landDip = S.landVel = 0; S.bobAmp = 0; S.roll = 0; S.stuckT = 0;
    const fl = S.space.floorAt(S.feet.x, S.feet.z, S.feet.y + 0.5); // placement points may be feet or roughly eye height: snap to the floor up to 2 m below
    S.floating = gravity() < 0.05;
    if (S.floating) { S.grounded = false; if (fl != null && fl > S.feet.y) S.feet.y = fl; }
    else if (fl != null && fl <= S.feet.y + 1.0 && fl >= S.feet.y - 2.0) { S.feet.y = fl; S.grounded = true; } else S.grounded = false;
    S.safe.copy(S.feet);
  }

  // ── seat transitions ──
  function beginStandUp(seat, yaw0, pitch0) {
    const eye0 = toV3(arr3(seat && seat.eye ? seat.eye : [0, 0, 0])).clone();
    const eye1 = new V3(S.feet.x, S.feet.y + STAND_H - EYE_DROP, S.feet.z); // feet were already placed + floor-snapped by place()
    S.trans = { kind: 'out', t: 0, dur: 0.9, from: eye0, to: eye1, yaw0, pitch0, yaw1: seat && seat.yaw != null ? seat.yaw : S.space.spawn.yaw || 0, pitch1: 0, lift: 0.1, sfx: 0 };
    S.yaw = yaw0; S.pitch = pitch0;
    S.eye.copy(eye0);
    // (the caller plays foley.unbuckle() — core already does — so the click is not doubled)
  }
  function beginSit() {
    const seat = S.seat || {};
    const eye1 = toV3(arr3(seat.eye || [0, 0, 0])).clone();
    S.trans = { kind: 'in', t: 0, dur: 0.9, from: S.eye.clone(), to: eye1, yaw0: S.yaw, pitch0: S.pitch, yaw1: seat.yaw || 0, pitch1: 0, lift: 0.06, sfx: 0 };
    I.clear(); setReticle(false);
  }
  function updateTransition(dt) {
    const tr = S.trans;
    tr.t += dt;
    const u = clamp(tr.t / tr.dur, 0, 1), e = easeIO(u);
    S.eye.lerpVectors(tr.from, tr.to, e);
    S.eye.y += Math.sin(Math.PI * u) * tr.lift;
    S.yaw = tr.yaw0 + wrapPi(tr.yaw1 - tr.yaw0) * e;
    S.pitch = lerp(tr.pitch0, tr.pitch1, e);
    S.roll = Math.sin(Math.PI * u) * (tr.kind === 'out' ? 0.015 : -0.012);
    // (foley.buckle() is played by the flight mode when it takes over — core does that — so it is not doubled here)
    if (tr.kind === 'out' && !tr.sfx && u > 0.82) { tr.sfx = 1; foley.step(surface(), 0.4); }
    if (u >= 1) {
      const kind = tr.kind;
      S.trans = null; S.roll = 0;
      if (kind === 'in') { S.trans = { kind: 'done' }; if (ctx.modes && ctx.modes.set) ctx.modes.set('flight', { from: 'walk' }); }
      else S.scanT = 1;
    }
  }

  // ── interaction ──
  function use() {
    const it = I.best;
    if (!it || S.trans) return;
    if (ctx.bus && ctx.bus.emit) ctx.bus.emit('interact', { id: it.id });
    try { if (it.use) it.use(); } catch (err) { console.error('[walk] interactable use() failed', it.id, err); }
    if (typeof it.id === 'string' && it.id.startsWith('seat.pilot') && S.active && !S.trans && (!ctx.modes || !ctx.modes.current || ctx.modes.current() === 'walk')) beginSit();
  }

  // ── physics ──
  const approach2 = (v, tx, tz, m) => { const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz); if (d <= m) { v.x = tx; v.z = tz; } else { v.x += (dx / d) * m; v.z += (dz / d) * m; } };
  const approach3 = (v, tx, ty, tz, m) => { const dx = tx - v.x, dy = ty - v.y, dz = tz - v.z, d = Math.hypot(dx, dy, dz); if (d <= m) v.set(tx, ty, tz); else { v.x += (dx / d) * m; v.y += (dy / d) * m; v.z += (dz / d) * m; } };

  function onLand(impact) {
    if (impact < 1.0) return;
    foley.land(surface(), impact);
    S.landVel += clamp(impact * 0.32, 0.2, 1.7);
    S.bobPhase = Math.round(S.bobPhase / Math.PI) * Math.PI;
    if (impact > 7.5 && ctx.fx) ctx.fx.shake = Math.max(ctx.fx.shake || 0, clamp(impact / 25, 0.1, 0.5));
  }

  function physics(h) {
    const sp = S.space, g = gravity(), p = S.feet, v = S.vel, down = (c) => keys.has(c);
    S.floating = g < 0.05;
    // stance
    let th = down('ControlLeft') || down('ControlRight') ? CROUCH_H : STAND_H;
    if (th > S.height + 1e-4 && !canStand()) th = S.height;
    const dh = th - S.height;
    S.height += Math.abs(dh) <= 5.5 * h ? dh : Math.sign(dh) * 5.5 * h;
    // intent
    const f = (down('KeyW') ? 1 : 0) - (down('KeyS') ? 1 : 0), s = (down('KeyD') ? 1 : 0) - (down('KeyA') ? 1 : 0), wl = Math.hypot(f, s);
    const nf = wl ? f / wl : 0, ns = wl ? s / wl : 0, sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);
    const crouchF = clamp((STAND_H - S.height) / (STAND_H - CROUCH_H), 0, 1);
    const shift = down('ShiftLeft') || down('ShiftRight');
    const sprintOK = shift && nf > 0.2 && crouchF < 0.15 && (S.grounded || S.floating);
    let speed = WALK.WALK;
    if (sprintOK) speed = lerp(WALK.WALK, WALK.SPRINT, clamp(nf * 1.4 - 0.2, 0, 1));
    speed *= lerp(1, WALK.CROUCH / WALK.WALK, crouchF);
    S.sprinting = sprintOK && wl > 0;
    const ox = p.x, oy = p.y, oz = p.z;

    if (S.floating) { // ── zero-g: drift with 3-D thrust, floors/ceilings/walls still stop you ──
      const cp = Math.cos(S.pitch), vy = (down('Space') ? 1 : 0) - (down('ControlLeft') || down('ControlRight') ? 1 : 0);
      let wx = -sy * cp * nf + cy * ns, wy = Math.sin(S.pitch) * nf + vy, wz = -cy * cp * nf - sy * ns;
      const l = Math.hypot(wx, wy, wz); if (l > 1) { wx /= l; wy /= l; wz /= l; }
      approach3(v, wx * speed, wy * speed, wz * speed, (wl || vy ? 4.5 : 2.2) * h);
      p.addScaledVector(v, h);
      const fl = sp.floorAt(p.x, p.z, p.y);
      if (fl != null && p.y < fl) { p.y = fl; if (v.y < 0) v.y = -v.y * 0.1; }
      if (sp.ceilingAt) { const c = sp.ceilingAt(p.x, p.z, p.y, S.height, RADIUS); if (p.y + S.height > c) { p.y = c - S.height; if (v.y > 0) v.y = -v.y * 0.1; } }
      const bx = p.x, bz = p.z; sp.collide(p, RADIUS, S.height);
      const dx = p.x - bx, dz = p.z - bz, dl = Math.hypot(dx, dz);
      if (dl > 1e-6) { const nx = dx / dl, nz = dz / dl, vn = v.x * nx + v.z * nz; if (vn < 0) { v.x -= nx * vn * 1.1; v.z -= nz * vn * 1.1; } }
      S.grounded = false; S.jumpBuf = 0;
      return;
    }

    // ── gravity walk ──
    const gf = clamp(0.3 + (0.7 * g) / 9.81, 0.3, 1.1);
    approach2(v, ((-sy * nf + cy * ns) * speed), ((-cy * nf - sy * ns) * speed), (S.grounded ? (wl ? 13 : 15) * gf : 3.2) * h);
    S.jumpBuf -= h;
    S.coyote = S.grounded ? 0.1 : S.coyote - h;
    if (S.jumpBuf > 0 && S.coyote > 0) {
      v.y = jumpSpeed(g) * lerp(1, 0.85, crouchF); S.grounded = false; S.coyote = 0; S.jumpBuf = 0;
      foley.jump(surface());
    }
    p.x += v.x * h; p.z += v.z * h;
    let fl = sp.floorAt(p.x, p.z, oy);
    if (S.grounded) {
      if (fl == null) { // edge of the walkable world: slide along it, or stop
        let f1 = sp.floorAt(p.x, oz, oy);
        if (f1 != null) { p.z = oz; v.z = 0; fl = f1; }
        else { f1 = sp.floorAt(ox, p.z, oy); if (f1 != null) { p.x = ox; v.x = 0; fl = f1; } else { p.x = ox; p.z = oz; v.x = v.z = 0; fl = sp.floorAt(ox, oz, oy); } }
      }
      if (fl != null && oy - fl <= STEP + 1e-4) { const d = fl - oy; p.y = fl; if (Math.abs(d) > 0.04) S.stepOff -= d; }
      else { S.grounded = false; v.y = 0; }
    }
    if (!S.grounded) {
      v.y = Math.max(v.y - g * h, -55);
      const ny = oy + v.y * h;
      if (fl != null && v.y <= 0 && ny <= fl + 1e-4) { const imp = -v.y; p.y = fl; v.y = 0; S.grounded = true; onLand(imp); }
      else p.y = ny;
      if (S.grounded === false && v.y > 0 && sp.ceilingAt) { const c = sp.ceilingAt(p.x, p.z, oy, S.height, RADIUS); if (p.y + S.height > c) { p.y = Math.min(p.y, c - S.height); v.y = 0; } }
      if (p.y < S.safe.y - 60) { p.copy(S.safe); v.set(0, 0, 0); S.grounded = true; } // fell out of the world
    }
    const bx = p.x, bz = p.z;
    sp.collide(p, RADIUS, S.height);
    const dx = p.x - bx, dz = p.z - bz, dl2 = dx * dx + dz * dz;
    if (dl2 > 1e-12) {
      const dl = Math.sqrt(dl2), nx = dx / dl, nz = dz / dl, vn = v.x * nx + v.z * nz;
      if (vn < 0) { v.x -= nx * vn; v.z -= nz * vn; }
      if (S.grounded) { const f2 = sp.floorAt(p.x, p.z, p.y); if (f2 == null) { p.x = ox; p.z = oz; } else if (Math.abs(f2 - p.y) <= STEP + 1e-4) p.y = f2; }
    }
    if (S.grounded && fl != null) S.safe.copy(p);
  }

  function post(dt) {
    const hs = Math.hypot(S.vel.x, S.vel.z);
    const crouchF = clamp((STAND_H - S.height) / (STAND_H - CROUCH_H), 0, 1);
    // stride → bob phase → foot-fall events
    if (S.grounded && hs > 0.15) {
      const stepLen = lerp(0.78, 0.55, crouchF) + (S.sprinting ? 0.42 : 0), prev = Math.floor(S.bobPhase / Math.PI);
      S.bobPhase += ((hs * dt) / stepLen) * Math.PI;
      if (Math.floor(S.bobPhase / Math.PI) > prev) foley.step(surface(), (crouchF > 0.5 ? 0.35 : S.sprinting ? 1 : 0.62) * clamp(0.5 + (0.5 * gravity()) / 9.81, 0.5, 1)); // lighter steps in low gravity
    }
    S.bobAmp = damp(S.bobAmp, S.grounded ? clamp(hs / 3.2, 0, 1) : 0, 8, dt);
    S.stepOff *= Math.exp(-11 * dt);
    // landing spring (positive = camera pushed down)
    S.landVel += (-150 * S.landDip - 15 * S.landVel) * dt; S.landDip += S.landVel * dt;
    S.fovKick = damp(S.fovKick, S.sprinting ? 2.2 : 0, 6, dt);
    // lean into strafes
    const rx = Math.cos(S.yaw), rz = -Math.sin(S.yaw), lat = S.vel.x * rx + S.vel.z * rz;
    S.roll = damp(S.roll, -lat * 0.004 + Math.sin(S.bobPhase) * 0.0045 * S.bobAmp, 10, dt);
    // stance sounds
    const cr = crouchF > 0.5;
    if (cr !== S.wasCrouch) { if (S.wasCrouch !== undefined) foley.crouch(cr); S.wasCrouch = cr; }
    // rooms
    trackRooms();
  }

  function trackRooms() {
    const rooms = S.space.rooms;
    if (!rooms || !rooms.length) return;
    const x = S.feet.x, y = S.feet.y + 0.15, z = S.feet.z;
    let best = null, bv = Infinity;
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i], a = arr3(r.min), b = arr3(r.max);
      if (x < a[0] || x > b[0] || y < a[1] || y > b[1] || z < a[2] || z > b[2]) continue;
      const vol = (b[0] - a[0]) * (b[1] - a[1]) * (b[2] - a[2]);
      if (vol < bv) { bv = vol; best = r; }
    }
    if (best && best !== S.room) { S.room = best; if (ctx.bus && ctx.bus.emit) ctx.bus.emit('room', { space: S.space.id, room: best.id, name: best.name }); }
  }

  function compose() {
    const tr = S.trans;
    let ex, ey, ez;
    if (tr) { ex = S.eye.x; ey = S.eye.y; ez = S.eye.z; }
    else {
      const eyeH = S.height - EYE_DROP, rx = Math.cos(S.yaw), rz = -Math.sin(S.yaw);
      const bobY = -0.018 * S.bobAmp * Math.cos(2 * S.bobPhase) + (1 - S.bobAmp) * 0.0022 * Math.sin(S.time * 1.7);
      const bobX = 0.010 * S.bobAmp * Math.sin(S.bobPhase);
      ex = S.feet.x + rx * bobX; ey = S.feet.y + eyeH + S.stepOff + bobY - S.landDip; ez = S.feet.z + rz * bobX;
      S.eye.set(ex, ey, ez);
    }
    pose.position.set(ex, ey, ez);
    eul.set(S.pitch - S.landDip * 0.35, S.yaw, S.roll, 'YXZ');
    pose.quaternion.setFromEuler(eul);
    pose.fov = ((ctx.settings && ctx.settings.fov) || 75) + S.fovKick;
  }

  function update(dt) {
    if (!S.active) return;
    dt = clamp(dt, 0, 0.1);
    S.time += dt;
    if (S.trans && S.trans.kind === 'done') { compose(); rigUpdate(rig, pose.position, pose.quaternion, dt, false); return; }
    if (S.trans) updateTransition(dt);
    else {
      const n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n;
      for (let i = 0; i < n; i++) physics(h);
      post(dt);
    }
    compose();
    rigUpdate(rig, pose.position, pose.quaternion, dt, true);
    if (!S.trans) {
      S.scanT += dt;
      if (S.scanT >= 0.05) {
        S.scanT = 0;
        const cp = Math.cos(S.pitch); fwdV.set(-Math.sin(S.yaw) * cp, Math.sin(S.pitch), -Math.cos(S.yaw) * cp);
        eyeV.copy(pose.position);
        I.scan(eyeV, fwdV, S.space.interactables || [], S.space);
        setReticle(true, !!I.best);
      }
    }
    foley.update(dt);
    if (S.space.update) S.space.update(dt);
  }

  const mode = {
    name: 'walk', hud: 'walk', reticle: true,
    help: [['W A S D', 'Move'], ['Shift', 'Sprint'], ['Space', 'Jump'], ['Ctrl', 'Crouch'], ['E', 'Interact'], ['F', 'Flashlight'], ['Mouse', 'Look']],
    state: S,
    /** enter({ space, from:'seat'|'spawn'|'airlock'|'pos', pos?, yaw?, pitch?, seat?:{eye,stand,yaw} }) */
    enter(opts = {}) {
      const space = opts.space || S.space || (ctx.spaces && typeof ctx.spaces.current === 'function' ? ctx.spaces.current() : null);
      if (!space || typeof space.floorAt !== 'function') { console.error('[walk] enter(): no WalkSpace given'); return; }
      S.space = space; S.active = true; S.trans = null; S.room = null; S.scanT = 0; S.jumpBuf = 0; S.sprinting = false; S.wasCrouch = undefined;
      I.clear();
      const from = opts.from || 'spawn';
      let entry = (space.entries && space.entries[from]) || null;
      if (!entry && !opts.pos && from === 'airlock' && ctx.shipModel && ctx.shipModel.airlock && ctx.shipModel.airlock.inner) entry = { pos: ctx.shipModel.airlock.inner };
      if (from === 'seat') {
        S.seat = opts.seat || (ctx.shipModel && ctx.shipModel.seats && ctx.shipModel.seats.pilot) || { eye: [0, 0, 0], stand: space.spawn.pos, yaw: space.spawn.yaw };
        place(S.seat.stand || space.spawn.pos, 0, 0);
        beginStandUp(S.seat, opts.yaw != null ? opts.yaw : 0, opts.pitch || 0);
      } else if (opts.pos || entry) {
        const e = opts.pos ? { pos: opts.pos, yaw: opts.yaw } : entry;
        place(e.pos, opts.yaw != null ? opts.yaw : e.yaw != null ? e.yaw : space.spawn.yaw, opts.pitch || 0);
      } else place(space.spawn.pos, opts.yaw != null ? opts.yaw : space.spawn.yaw, opts.pitch || 0);
      if (opts.seat && from !== 'seat') S.seat = opts.seat;
      compose();
      rigUpdate(rig, pose.position, pose.quaternion, 0.016, true);
      setReticle(true, false);
      foley.warm();
    },
    exit() {
      S.active = false; S.trans = null; I.clear(); setReticle(false);
      rigOff(rig);
    },
    update,
    cameraPose() { return pose; },
    teleport(pos, yaw) { if (S.space) place(pos, yaw != null ? yaw : S.yaw, S.pitch); },
    setFlashlight(on) { rig.on = !!on; },
    get flashlight() { return rig.on; },
    onKeyDown(e) {
      if (e.repeat || !S.active) return;
      if (e.code === 'KeyE') use();
      else if (e.code === 'KeyF') { rig.on = !rig.on; foley.beep('light'); }
      else if (e.code === 'Space') S.jumpBuf = 0.14;
    },
    onKeyUp() {},
    onMouseMove(e) {
      if (!S.active || (S.trans && S.trans.kind !== 'out')) return;
      const k = 0.0022 * ((ctx.settings && ctx.settings.sens) || 1), mx = clamp(e.movementX || 0, -250, 250), my = clamp(e.movementY || 0, -250, 250);
      if (S.trans) { S.trans.yaw1 -= mx * k; S.trans.pitch1 = clamp(S.trans.pitch1 - ((ctx.settings && ctx.settings.invertY) ? -1 : 1) * my * k, -1.5, 1.5); return; }
      S.yaw = wrapPi(S.yaw - mx * k);
      S.pitch = clamp(S.pitch - ((ctx.settings && ctx.settings.invertY) ? -1 : 1) * my * k, -1.5, 1.5);
    },
    onMouseDown() {},
    onWheel() {},
  };
  return mode;
}

// ─────────────────────────────────────────── EVA helmet overlay ───────────────────────────────────────────
const EVA_CSS = `
.evh{--ec:var(--c,#86ecff);--ecd:var(--cd,rgba(134,236,255,.55));--eamber:var(--amber,#ffb04d);--ered:var(--red,#ff4d6a);--eok:var(--ok,#6cffb0);--eink:var(--ink,#e9fbff);
  --emono:var(--mono,'Share Tech Mono',ui-monospace,Consolas,monospace);--edisp:var(--disp,'Orbitron','Segoe UI',sans-serif);--eui:var(--ui,'Rajdhani','Segoe UI',system-ui,sans-serif);
  position:fixed;inset:0;pointer-events:none;z-index:4;font-family:var(--eui);color:var(--ec);user-select:none;transition:opacity .5s}
.evh *{box-sizing:border-box}
.evh-tint{position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 50% 45%,rgba(120,205,235,.035),rgba(90,170,210,.07))}
.evh svg.evh-rim{position:absolute;inset:0;width:100%;height:100%}
.evh-fog{position:absolute;inset:0;background:radial-gradient(ellipse 44% 30% at 50% 104%,rgba(225,246,255,.30),rgba(225,246,255,.10) 45%,transparent 72%);opacity:0;mix-blend-mode:screen}
.evh-panel{position:absolute;padding:9px 13px 10px;min-width:206px;background:linear-gradient(135deg,rgba(8,26,40,.62),rgba(3,10,18,.30));border:1px solid rgba(134,236,255,.20);
  box-shadow:inset 0 0 28px rgba(40,190,255,.07),0 0 18px rgba(0,0,0,.35);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
.evh-panel::before{content:"";position:absolute;left:0;top:0;width:22px;height:2px;background:var(--ec);box-shadow:0 0 8px var(--ec)}
.evh-panel::after{content:"";position:absolute;right:0;bottom:0;width:22px;height:2px;background:var(--ec);box-shadow:0 0 8px var(--ec)}
.evh-tl{left:12.2%;top:14.5%}.evh-tr{right:12.2%;top:14.5%;text-align:right}
.evh-ph{font-family:var(--edisp);font-size:10px;letter-spacing:.32em;color:var(--ecd);margin-bottom:6px;display:flex;justify-content:space-between;gap:16px}
.evh-ph b{color:var(--ec);font-weight:700;letter-spacing:.2em}
.evh-row{display:flex;justify-content:space-between;gap:14px;line-height:1.38;font-size:12.5px;white-space:nowrap}
.evh-row .k{letter-spacing:.14em;color:var(--ecd);font-weight:600;font-size:11px}
.evh-row .v{font-family:var(--emono);color:var(--eink);text-shadow:0 0 6px rgba(134,236,255,.55);font-size:13.5px}
.evh .warn{color:var(--eamber)!important;text-shadow:0 0 8px rgba(255,176,77,.7)!important}.evh .bad{color:var(--ered)!important;text-shadow:0 0 10px rgba(255,77,106,.85)!important}.evh .good{color:var(--eok)!important}
.evh-bar{height:3px;margin:3px 0 6px;background:rgba(134,236,255,.14);position:relative;overflow:hidden}
.evh-bar i{position:absolute;left:0;top:0;bottom:0;width:50%;background:var(--ec);box-shadow:0 0 8px var(--ec);transition:background .3s}
.evh-bar i.warn{background:var(--eamber);box-shadow:0 0 8px var(--eamber)}.evh-bar i.bad{background:var(--ered);box-shadow:0 0 8px var(--ered)}
.evh-big{font-family:var(--emono);font-size:26px;color:#fff;text-shadow:0 0 12px rgba(134,236,255,.8);line-height:1.1;margin:2px 0 2px}
.evh-big small{font-size:13px;color:var(--ecd);text-shadow:none;margin-left:5px}
.evh-keys{position:absolute;left:50%;bottom:5.2%;transform:translateX(-50%);font-family:var(--eui);font-size:13px;letter-spacing:.07em;color:rgba(205,246,255,.78);text-shadow:0 0 8px rgba(0,0,0,.9);white-space:nowrap}
.evh-keys kbd{font-family:var(--emono);font-size:11px;padding:1px 5px;border:1px solid var(--ecd);border-radius:3px;color:#fff;background:rgba(134,236,255,.08);margin:0 2px 0 9px}
.evh-mk{position:absolute;left:0;top:0;width:0;height:0;font-family:var(--edisp);font-size:10px;letter-spacing:.2em;color:var(--ec);text-shadow:0 0 8px rgba(0,0,0,.9);will-change:transform;white-space:nowrap}
.evh-mk i{position:absolute;left:-7px;top:-7px;width:13px;height:13px;border:1.5px solid var(--ec);transform:rotate(45deg);box-shadow:0 0 10px rgba(134,236,255,.7),inset 0 0 6px rgba(134,236,255,.35)}
.evh-mk span{position:absolute;left:15px;top:-7px;line-height:14px}
.evh-mk.r span{left:auto;right:15px;text-align:right}
.evh-mk.off i{border-radius:50%;transform:none}
.evh-cross{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border:1px solid rgba(134,236,255,.20);border-radius:50%}
.evh-cross::after{content:"";position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;border-radius:50%;background:rgba(220,248,255,.7)}
`;
const EVA_RIM_SVG = `<svg class="evh-rim" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<defs>
<filter id="evhBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="34"/></filter>
<linearGradient id="evhRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1016"/><stop offset=".5" stop-color="#05080c"/><stop offset="1" stop-color="#0b1219"/></linearGradient>
<linearGradient id="evhGloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfefff" stop-opacity=".16"/><stop offset="1" stop-color="#cfefff" stop-opacity="0"/></linearGradient>
<clipPath id="evhWin"><path d="M430 52H1170C1388 52 1546 206 1546 420V480C1546 694 1388 848 1170 848H430C212 848 54 694 54 480V420C54 206 212 52 430 52Z"/></clipPath>
</defs>
<g clip-path="url(#evhWin)"><path d="M430 52H1170C1388 52 1546 206 1546 420V480C1546 694 1388 848 1170 848H430C212 848 54 694 54 480V420C54 206 212 52 430 52Z" fill="none" stroke="#000" stroke-opacity=".75" stroke-width="110" filter="url(#evhBlur)"/>
<polygon points="150,120 330,120 120,520 -60,520" fill="url(#evhGloss)" opacity=".55"/><polygon points="360,120 410,120 200,520 150,520" fill="url(#evhGloss)" opacity=".4"/></g>
<path fill="url(#evhRim)" fill-rule="evenodd" d="M0 0H1600V900H0Z M430 52H1170C1388 52 1546 206 1546 420V480C1546 694 1388 848 1170 848H430C212 848 54 694 54 480V420C54 206 212 52 430 52Z"/>
<path d="M430 52H1170C1388 52 1546 206 1546 420V480C1546 694 1388 848 1170 848H430C212 848 54 694 54 480V420C54 206 212 52 430 52Z" fill="none" stroke="rgba(150,225,250,.34)" stroke-width="1.6"/>
<path d="M430 66H1170C1380 66 1532 214 1532 420V480C1532 686 1380 834 1170 834H430C220 834 68 686 68 480V420C68 214 220 66 430 66Z" fill="none" stroke="rgba(134,236,255,.10)" stroke-width="1"/>
</svg>`;

function buildOverlay() {
  if (typeof document === 'undefined') return null;
  if (!document.getElementById('orpheus-eva-css')) { const st = document.createElement('style'); st.id = 'orpheus-eva-css'; st.textContent = EVA_CSS; document.head.appendChild(st); }
  const root = document.createElement('div');
  root.className = 'evh';
  root.innerHTML = `<div class="evh-tint"></div><div class="evh-fog" data-k="fog"></div>${EVA_RIM_SVG}<div class="evh-cross"></div>
<div class="evh-panel evh-tl"><div class="evh-ph"><span>EVA · SUIT</span><b data-k="stat">NOMINAL</b></div>
<div class="evh-row"><span class="k">O₂</span><span class="v" data-k="o2">98.0 %</span></div><div class="evh-bar"><i data-k="o2b"></i></div>
<div class="evh-row"><span class="k">POWER</span><span class="v" data-k="pw">100 %</span></div><div class="evh-bar"><i data-k="pwb"></i></div>
<div class="evh-row"><span class="k">TEMP</span><span class="v" data-k="tmp">21.4 °C</span></div>
<div class="evh-row"><span class="k">DAMPERS</span><span class="v" data-k="damp">ON</span></div>
<div class="evh-row"><span class="k">LIGHT</span><span class="v" data-k="lamp">OFF</span></div></div>
<div class="evh-panel evh-tr"><div class="evh-ph"><span>TETHER</span><b data-k="tstat">SLACK</b></div>
<div class="evh-big"><span data-k="tlen">0.0</span><small>/ 60 m</small></div><div class="evh-bar"><i data-k="tbar"></i></div>
<div class="evh-row"><span class="k">SPEED</span><span class="v" data-k="vel">0.00 m/s</span></div>
<div class="evh-row"><span class="k">AIRLOCK</span><span class="v" data-k="brg">—</span></div></div>
<div class="evh-mk" data-k="mk"><i></i><span data-k="mkt">AIRLOCK</span></div>
<div class="evh-keys"><kbd>W A S D</kbd>THRUST<kbd>SPACE</kbd>UP<kbd>CTRL</kbd>DOWN<kbd>Q E</kbd>ROLL<kbd>SHIFT</kbd>BOOST<kbd>Z</kbd>DAMPERS<kbd>F</kbd>LIGHT</div>`;
  const q = {};
  root.querySelectorAll('[data-k]').forEach((el) => { q[el.dataset.k] = el; });
  const cache = {};
  const text = (k, v) => { if (cache[k] !== v) { cache[k] = v; q[k].textContent = v; } };
  const cls = (k, c) => { if (cache['c' + k] !== c) { cache['c' + k] = c; q[k].className = c; } }; // full className, only written when it changes
  return { root, q, text, cls };
}

// ─────────────────────────────────────────── tether cable mesh ───────────────────────────────────────────
function createTether(ctx) {
  const N = 28, R = 6, vcount = (N + 1) * R;
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(vcount * 3), nor = new Float32Array(vcount * 3), idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) { const a = i * R + j, b = i * R + ((j + 1) % R), c = (i + 1) * R + j, d = (i + 1) * R + ((j + 1) % R); idx.push(a, c, b, b, c, d); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd2c4a2, roughness: 0.72, metalness: 0.0, emissive: 0x2c2518 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.visible = false; mesh.name = 'eva-tether';
  if (ctx.scenes && ctx.scenes.near) ctx.scenes.near.add(mesh);
  const P0 = new V3(), P1 = new V3(), P2 = new V3(), P3 = new V3(), dir = new V3(), pa = new V3(), pb = new V3(), c = new V3(), tg = new V3(), nrm = new V3(), bn = new V3(), ref = new V3();
  const bez = (u, out) => { const w = 1 - u; return out.set(0, 0, 0).addScaledVector(P0, w * w * w).addScaledVector(P1, 3 * w * w * u).addScaledVector(P2, 3 * w * u * u).addScaledVector(P3, u * u * u); };
  return {
    mesh,
    update(anchor, hip, camPos, t, slack) {
      P0.copy(anchor); P3.copy(hip);
      dir.subVectors(P3, P0); const d = Math.max(dir.length(), 1e-3); dir.divideScalar(d);
      ref.set(Math.abs(dir.y) < 0.9 ? 0 : 1, Math.abs(dir.y) < 0.9 ? 1 : 0, 0);
      pa.crossVectors(dir, ref).normalize(); pb.crossVectors(dir, pa).normalize();
      const amp = slack * Math.min(7, d * 0.4);
      P1.copy(P0).addScaledVector(dir, d * 0.33).addScaledVector(pa, Math.cos(t * 0.6) * amp).addScaledVector(pb, Math.sin(t * 0.47) * amp);
      P2.copy(P0).addScaledVector(dir, d * 0.66).addScaledVector(pa, Math.sin(t * 0.5 + 1) * amp).addScaledVector(pb, Math.cos(t * 0.71 + 2) * amp);
      nrm.copy(pa);
      for (let i = 0; i <= N; i++) {
        const u = i / N; bez(u, c);
        bez(Math.min(1, u + 0.01), tg); bez(Math.max(0, u - 0.01), bn); tg.sub(bn).normalize();
        nrm.addScaledVector(tg, -nrm.dot(tg)).normalize(); bn.crossVectors(tg, nrm);
        const rad = Math.max(0.008, 0.0008 * c.distanceTo(camPos)); // ~1.6 cm cable, fattened with distance so it stays a visible line
        for (let j = 0; j < R; j++) {
          const th = (j / R) * TAU, cs = Math.cos(th), sn = Math.sin(th), k = (i * R + j) * 3;
          const nx = nrm.x * cs + bn.x * sn, ny = nrm.y * cs + bn.y * sn, nz = nrm.z * cs + bn.z * sn;
          pos[k] = c.x + nx * rad; pos[k + 1] = c.y + ny * rad; pos[k + 2] = c.z + nz * rad; nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
        }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
    },
  };
}

// ─────────────────────────────────────────────── EVA mode ───────────────────────────────────────────────
const EVA = {
  R: 0.45, TETHER: 60, SLACK: 40, ACC: 2.2, BOOST: 5.5, VMAX: 4, VMAXB: 11, BRAKE: 1.8, ROLL: 1.7, REST: 0.28,
};

export function createEvaMode(ctx) {
  const foley = createFoley(ctx), rig = getRig(ctx), I = createInteractor(ctx, 'R', { omni: true }), tether = createTether(ctx); // EVA: orientation is arbitrary, so no view cone
  const keys = ctx.input && ctx.input.keys ? ctx.input.keys : new Set();
  const S = {
    active: false, pos: new V3(), vel: new V3(), q: new Q4(), rollVel: 0, anchor: new V3(), hull: [], damp: true, list: [], space: null,
    time: 0, o2: 98, pw: 100, thrust: 0, lastBump: -9, lastTug: -9, warned: false, scanT: 0, hudT: 0, opts: null, jolt: new V3(), views: null, gaze: { drive: 0, name: 0 }, viewT: 0, spd: 0,
  };
  const pose = { position: new V3(), quaternion: new Q4(), fov: 75 };
  const right = new V3(), up = new V3(), fwd = new V3(), tmp = new V3(), tmp2 = new V3(), wish = new V3(), dq = new Q4(), hip = new V3(), eul = new EUL(0, 0, 0, 'YXZ');
  const AX = { x: new V3(1, 0, 0), y: new V3(0, 1, 0), z: new V3(0, 0, 1) };
  let overlay = null, markerCam = null, lastThr = 0;
  const INFO = { wl: 0, boost: false };

  function basis() { right.set(1, 0, 0).applyQuaternion(S.q); up.set(0, 1, 0).applyQuaternion(S.q); fwd.set(0, 0, -1).applyQuaternion(S.q); }

  function collideHull(now) {
    const p = S.pos, r = EVA.R;
    let impact = 0;
    for (let it = 0; it < 3; it++) {
      let hit = false;
      for (let i = 0; i < S.hull.length; i++) {
        const mn = S.hull[i].mn, mx = S.hull[i].mx;
        const qx = clamp(p.x, mn[0], mx[0]), qy = clamp(p.y, mn[1], mx[1]), qz = clamp(p.z, mn[2], mx[2]);
        const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r * r) continue;
        let nx, ny, nz, pen;
        if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d; pen = r - d; }
        else { // centre inside the box → nearest face
          const f = [p.x - mn[0], mx[0] - p.x, p.y - mn[1], mx[1] - p.y, p.z - mn[2], mx[2] - p.z];
          let k = 0; for (let j = 1; j < 6; j++) if (f[j] < f[k]) k = j;
          nx = ny = nz = 0; if (k === 0) nx = -1; else if (k === 1) nx = 1; else if (k === 2) ny = -1; else if (k === 3) ny = 1; else if (k === 4) nz = -1; else nz = 1;
          pen = f[k] + r;
        }
        p.x += nx * pen; p.y += ny * pen; p.z += nz * pen;
        const vn = S.vel.x * nx + S.vel.y * ny + S.vel.z * nz;
        if (vn < 0) { S.vel.x -= nx * vn * (1 + EVA.REST); S.vel.y -= ny * vn * (1 + EVA.REST); S.vel.z -= nz * vn * (1 + EVA.REST); impact = Math.max(impact, -vn); }
        hit = true;
      }
      if (!hit) break;
    }
    if (impact > 0.4 && now - S.lastBump > 0.18) {
      S.lastBump = now; foley.bump(impact);
      S.jolt.set((Math.random() - 0.5) * 0.02 * Math.min(impact, 3), (Math.random() - 0.5) * 0.02 * Math.min(impact, 3), (Math.random() - 0.5) * 0.03 * Math.min(impact, 3));
    }
  }

  function physics(h) {
    const ax = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), ay = (keys.has('Space') ? 1 : 0) - ((keys.has('ControlLeft') || keys.has('ControlRight')) ? 1 : 0), az = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const boost = keys.has('ShiftLeft') || keys.has('ShiftRight');
    wish.set(0, 0, 0).addScaledVector(right, ax).addScaledVector(up, ay).addScaledVector(fwd, az);
    const wl = wish.length();
    if (wl > 1) wish.divideScalar(wl);
    const acc = boost ? EVA.BOOST : EVA.ACC, vmax = boost ? EVA.VMAXB : EVA.VMAX;
    if (wl > 0) { // thrust, capped so it never brakes velocity that is already above the cap
      const dirv = tmp.copy(wish).normalize(), proj = S.vel.dot(dirv), dv = Math.min(acc * Math.min(wl, 1) * h, Math.max(0, vmax - proj));
      S.vel.addScaledVector(dirv, dv);
    }
    if (S.damp) { // gentle per-axis dampers: bleed velocity on every local axis that has no input
      const axes = [[right, ax], [up, ay], [fwd, az]];
      for (let i = 0; i < 3; i++) {
        if (axes[i][1] !== 0) continue;
        const c = S.vel.dot(axes[i][0]), dec = Math.min(Math.abs(c), (EVA.BRAKE * 0.55 + 0.45 * Math.abs(c)) * h);
        S.vel.addScaledVector(axes[i][0], -Math.sign(c) * dec);
      }
    }
    S.pos.addScaledVector(S.vel, h);
    // tether: soft spring + outward damping beyond SLACK, hard stop at TETHER
    tmp.subVectors(S.pos, S.anchor);
    const d = tmp.length();
    if (d > EVA.SLACK) {
      tmp.divideScalar(d);
      const stretch = d - EVA.SLACK;
      S.vel.addScaledVector(tmp, -0.45 * stretch * h);
      const vo = S.vel.dot(tmp);
      if (vo > 0) S.vel.addScaledVector(tmp, -vo * Math.min(1, (1.2 + stretch * 0.12) * h));
      if (d > EVA.TETHER) {
        S.pos.copy(S.anchor).addScaledVector(tmp, EVA.TETHER);
        const vo2 = S.vel.dot(tmp);
        if (vo2 > 0) {
          S.vel.addScaledVector(tmp, -vo2 * 1.3);
          if (S.time - S.lastTug > 0.7 && vo2 > 0.8) { S.lastTug = S.time; foley.tether(vo2); }
        }
      }
    }
    collideHull(S.time);
    INFO.wl = Math.min(wl, 1); INFO.boost = boost;
    return INFO;
  }

  function projectMarker(wpos, out) {
    if (!markerCam) markerCam = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 5000);
    markerCam.fov = pose.fov; markerCam.aspect = (typeof innerWidth === 'number' && innerHeight) ? innerWidth / innerHeight : 16 / 9;
    markerCam.position.copy(pose.position); markerCam.quaternion.copy(pose.quaternion); markerCam.updateProjectionMatrix(); markerCam.updateMatrixWorld(true);
    out.copy(wpos).project(markerCam);
    return out;
  }

  function updateHud(dt) {
    if (!overlay) return;
    const o = overlay, d = tmp.subVectors(S.pos, S.anchor).length(), spd = S.vel.length();
    S.o2 = Math.max(0, S.o2 - 0.012 * dt); S.pw = Math.max(0, S.pw - (0.01 + 0.06 * S.thrust) * dt);
    // marker follows every frame; panels at ~10 Hz
    const mk = o.q.mk, nd = tmp2;
    projectMarker(S.anchor, nd);
    const behind = nd.z > 1;
    let sx = nd.x, sy = nd.y;
    if (behind) { sx = -sx; sy = -sy; }
    const off = behind || Math.abs(sx) > 0.86 || Math.abs(sy) > 0.78;
    if (off) {
      const m = Math.max(Math.abs(sx) / 0.86, Math.abs(sy) / 0.78);
      if (m < 0.08) { sx = 0; sy = -0.78; } else { sx /= m; sy /= m; } // dead behind → point down
    }
    const W = typeof innerWidth === 'number' ? innerWidth : 1280, H = typeof innerHeight === 'number' ? innerHeight : 720;
    const px = (sx * 0.5 + 0.5) * W, py = (-sy * 0.5 + 0.5) * H;
    mk.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
    mk.classList.toggle('off', off);
    mk.classList.toggle('r', sx > 0.45);
    o.q.fog.style.opacity = String(clamp(foley.breathLevel() * 0.8, 0, 1));
    S.hudT += dt;
    if (S.hudT < 0.1) return;
    S.hudT = 0;
    const lim = d / EVA.TETHER, tcls = lim > 0.9 ? 'bad' : lim > 0.72 ? 'warn' : '';
    o.text('mkt', off ? `AIRLOCK ${d.toFixed(0)} m` : `AIRLOCK · ${d.toFixed(0)} m`);
    o.text('tlen', d.toFixed(1)); o.q.tbar.style.width = clamp(lim * 100, 0, 100).toFixed(1) + '%'; o.cls('tbar', tcls);
    o.text('tstat', lim > 0.97 ? 'AT LIMIT' : lim > 0.72 ? 'TAUT' : d < 3 ? 'DOCKED' : 'SLACK');
    o.cls('tstat', tcls); o.cls('tlen', tcls);
    o.text('vel', spd.toFixed(2) + ' m/s');
    // bearing of the airlock relative to the helmet: azimuth (R/L) and elevation (U/D)
    tmp.subVectors(S.anchor, S.pos);
    const az = Math.atan2(tmp.dot(right), tmp.dot(fwd)) * 57.2958, el = Math.asin(clamp(tmp.dot(up) / Math.max(d, 1e-3), -1, 1)) * 57.2958;
    o.text('brg', d < 1.5 ? 'AT HATCH' : `${az >= 0 ? 'R' : 'L'} ${Math.abs(az).toFixed(0)}° · ${el >= 0 ? 'U' : 'D'} ${Math.abs(el).toFixed(0)}°`);
    o.text('o2', S.o2.toFixed(1) + ' %'); o.q.o2b.style.width = S.o2 + '%';
    o.text('pw', S.pw.toFixed(0) + ' %'); o.q.pwb.style.width = S.pw + '%'; o.cls('pwb', S.pw < 20 ? 'bad' : S.pw < 45 ? 'warn' : '');
    o.text('tmp', (21.4 + Math.sin(S.time * 0.07) * 0.3 - 0.4 * S.thrust).toFixed(1) + ' °C');
    o.text('damp', S.damp ? 'ON' : 'OFF'); o.cls('damp', 'v ' + (S.damp ? 'good' : 'warn'));
    o.text('lamp', rig.on ? 'ON' : 'OFF'); o.cls('lamp', 'v ' + (rig.on ? 'good' : ''));
    o.text('stat', lim > 0.97 ? 'TETHER' : S.o2 < 15 ? 'LOW O₂' : 'NOMINAL'); o.cls('stat', lim > 0.97 ? 'bad' : S.o2 < 15 ? 'warn' : '');
  }

  function checkViews(dt) {
    S.viewT += dt;
    if (S.viewT < 0.25 || !S.views) return;
    const step = S.viewT; S.viewT = 0;
    for (const key of ['drive', 'name']) {
      const pts = S.views[key];
      if (!pts || S.gaze[key] < 0) continue;
      let hit = false;
      for (const pt of pts) {
        tmp.subVectors(pt, S.pos); const d = tmp.length();
        if (d > 5 && d < 90 && tmp.divideScalar(d).dot(fwd) > 0.96) { hit = true; break; }
      }
      S.gaze[key] = hit ? S.gaze[key] + step : Math.max(0, S.gaze[key] - step * 2);
      if (S.gaze[key] > 1.4) {
        S.gaze[key] = -1;
        const id = 'eva.view.' + key, say = () => { if (ctx.say) ctx.say(id); };
        if (ctx.flags && ctx.flags.once) ctx.flags.once(id, say); else say();
      }
    }
  }

  function viewpoints(opts) {
    const v = opts.viewpoints || (opts.hull && opts.hull.viewpoints) || null, out = {};
    const pt = (a) => toV3(arr3(a)).clone();
    if (v && v.drive) out.drive = [pt(v.drive)];
    if (v && v.name) out.name = (Array.isArray(v.name[0]) || isVec(v.name[0])) ? v.name.map(pt) : [pt(v.name)];
    const b = opts.hull && opts.hull.bounds;
    if (b && b.min && b.max) {
      const c = new V3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      if (!out.drive) out.drive = [new V3(c.x, c.y, b.max.z)];
      if (!out.name) out.name = [new V3(b.min.x, c.y, c.z), new V3(b.max.x, c.y, c.z)];
    }
    return out.drive || out.name ? out : null;
  }

  function update(dt) {
    if (!S.active) return;
    dt = clamp(dt, 0, 0.1);
    S.time += dt;
    // roll
    const rin = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
    S.rollVel = rin ? damp(S.rollVel, rin * EVA.ROLL, 5, dt) : damp(S.rollVel, 0, S.damp ? 4 : 0.6, dt);
    if (Math.abs(S.rollVel) > 1e-4) S.q.multiply(dq.setFromAxisAngle(AX.z, S.rollVel * dt)).normalize();
    basis();
    const n = Math.max(1, Math.ceil(dt / 0.011)), h = dt / n;
    let info = INFO;
    for (let i = 0; i < n; i++) info = physics(h);
    // tether warning (once per approach)
    const d = tmp.subVectors(S.pos, S.anchor).length();
    if (!S.warned && d > 50) { S.warned = true; if (ctx.say) ctx.say('eva.tether'); foley.beep('warn'); }
    else if (S.warned && d < 38) S.warned = false;
    // suit sound
    S.thrust = damp(S.thrust, info.wl * (info.boost ? 1.25 : 1), 10, dt);
    const thr = S.thrust < 0.03 ? 0 : S.thrust;
    if ((thr > 0) !== (lastThr > 0) || Math.abs(thr - lastThr) > 0.06) { foley.thruster(thr > 0, thr); lastThr = thr; }
    foley.breath(1 + 0.45 * S.thrust);
    foley.update(dt);
    // pose
    const sv = S.vel.length(); S.spd = sv;
    S.jolt.multiplyScalar(Math.exp(-7 * dt));
    pose.position.copy(S.pos);
    pose.quaternion.copy(S.q);
    if (S.jolt.lengthSq() > 1e-10) { eul.set(S.jolt.x, S.jolt.y, S.jolt.z, 'YXZ'); pose.quaternion.multiply(dq.setFromEuler(eul)); }
    pose.fov = (ctx.settings && ctx.settings.fov) || 75;
    rigUpdate(rig, pose.position, pose.quaternion, dt, true);
    // tether cable from the suit's hip back to the airlock
    hip.set(0.16, -0.42, 0.1).applyQuaternion(S.q).add(S.pos);
    tether.update(S.anchor, hip, S.pos, S.time, clamp((EVA.SLACK + 8 - d) / (EVA.SLACK + 8), 0, 1));
    // interactions
    S.scanT += dt;
    if (S.scanT >= 0.05) { S.scanT = 0; tmp.copy(fwd); I.scan(pose.position, tmp, S.list, S.space); }
    checkViews(dt);
    updateHud(dt);
  }

  const mode = {
    name: 'eva', hud: 'walk',
    help: [['W A S D', 'Thrust'], ['Space / Ctrl', 'Up / down'], ['Q E', 'Roll'], ['Shift', 'Boost'], ['Z', 'Dampers'], ['F', 'Flashlight'], ['R', 'Use / return'], ['Mouse', 'Look']],
    state: S,
    /** enter({ anchor, hull:{colliders,bounds?,viewpoints?}, pos, yaw, interactables?, onReturn?, space?, vel?, viewpoints? }) */
    enter(opts = {}) {
      S.opts = opts; S.active = true; S.space = opts.space || null;
      S.anchor.copy(toV3(arr3(opts.anchor || opts.pos || [0, 0, 0])));
      const p = opts.pos ? arr3(opts.pos) : [S.anchor.x, S.anchor.y, S.anchor.z];
      S.pos.set(p[0], p[1], p[2]);
      S.vel.copy(opts.vel ? toV3(arr3(opts.vel)) : new V3());
      S.q.setFromEuler(eul.set(0, opts.yaw || 0, 0, 'YXZ'));
      S.rollVel = 0; S.thrust = 0; S.warned = false; S.time = 0; S.hudT = 1; S.jolt.set(0, 0, 0); S.gaze.drive = S.gaze.name = 0;
      S.hull = ((opts.hull && opts.hull.colliders) || []).map((c) => ({ mn: arr3(c.min), mx: arr3(c.max) }));
      S.views = viewpoints(opts);
      let list = opts.interactables ? opts.interactables.slice() : [];
      if (!list.length) {
        list = [{
          id: 'airlock.outer', label: 'RE-ENTER AIRLOCK', pos: S.anchor.clone(), radius: 2.6,
          use: () => { if (ctx.say) ctx.say('eva.return'); if (opts.onReturn) opts.onReturn(); else if (ctx.modes && ctx.modes.set) ctx.modes.set('walk', { space: opts.space, from: 'airlock' }); },
        }];
      }
      S.list = list; I.clear();
      if (!overlay) overlay = buildOverlay();
      if (overlay && !overlay.root.parentNode) document.body.appendChild(overlay.root);
      if (overlay) overlay.root.style.display = '';
      tether.mesh.visible = true;
      rigUpdate(rig, S.pos, S.q, 0.016, true);
      basis();
      pose.position.copy(S.pos); pose.quaternion.copy(S.q); pose.fov = (ctx.settings && ctx.settings.fov) || 75;
      foley.breath(1); foley.warm();
    },
    exit() {
      S.active = false; I.clear(); lastThr = 0;
      foley.thruster(false); foley.breath(0);
      tether.mesh.visible = false;
      if (overlay) overlay.root.style.display = 'none';
      rigOff(rig);
    },
    update,
    cameraPose() { return pose; },
    setFlashlight(on) { rig.on = !!on; },
    get flashlight() { return rig.on; },
    onKeyDown(e) {
      if (e.repeat || !S.active) return;
      if (e.code === 'KeyF') { rig.on = !rig.on; foley.beep('light'); }
      else if (e.code === 'KeyZ') { S.damp = !S.damp; foley.beep(S.damp ? 'ok' : 'click'); }
      else if (e.code === 'KeyR' || e.code === 'Enter') {
        const it = I.best;
        if (!it) return;
        if (ctx.bus && ctx.bus.emit) ctx.bus.emit('interact', { id: it.id });
        try { if (it.use) it.use(); } catch (err) { console.error('[eva] interactable use() failed', it.id, err); }
      }
    },
    onKeyUp() {},
    onMouseMove(e) {
      if (!S.active) return;
      const k = 0.0022 * ((ctx.settings && ctx.settings.sens) || 1), mx = clamp(e.movementX || 0, -250, 250), my = clamp(e.movementY || 0, -250, 250);
      S.q.multiply(dq.setFromAxisAngle(AX.y, -mx * k)).multiply(dq.setFromAxisAngle(AX.x, -((ctx.settings && ctx.settings.invertY) ? -1 : 1) * my * k)).normalize();
    },
    onMouseDown() {},
    onWheel() {},
  };
  return mode;
}
