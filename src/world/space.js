// ORPHEUS — worlds: orbits, far-pass rendering, nav targets, approach / land / dock flows, HUD markers.
// See src/world/catalog.js for data and frame conventions. Positions are KS Cartesian in M (1 M = 1 light-second);
// ship space is metres, x = right, y = up, z = −forward; "body components" are (right, up, forward).
//
// Frame handling: offsets/positions use the Euclidean body axes (exactly invertible); attitudes use the same axes
// pushed through the body's rest frame and Gram–Schmidt'd with the metric ("ortho" 4-vectors), so a docked station
// seen through ctx.kerr.toBody is exactly aligned with the ship.
import { bodies as BODIES, byId, LIGHT, KM_PER_M } from './catalog.js';
import SHADERS from './shaders/index.js';
import { VERT, SPRITE_VERT, SPRITE_FRAG, PLASMA_FRAG, buildFragment } from './shaders/common.js';

const DEG = Math.PI / 180;
const MPM = KM_PER_M * 1000;                 // metres per M
const TAU = Math.PI * 2;

// ── small vector helpers (plain arrays) ────────────────────────────────────────────────────────────────────────────
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const comb = (ax, c) => [ax[0][0] * c[0] + ax[1][0] * c[1] + ax[2][0] * c[2], ax[0][1] * c[0] + ax[1][1] * c[1] + ax[2][1] * c[2], ax[0][2] * c[0] + ax[1][2] * c[1] + ax[2][2] * c[2]];
const comb4 = (ax, c) => [0, 1, 2, 3].map((k) => ax[0][k] * c[0] + ax[1][k] * c[1] + ax[2][k] * c[2]);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

function fmtDist(M) {
  const km = M * KM_PER_M;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (M < 1) return `${Math.round(km).toLocaleString('en-US')} km`;
  return `${M.toFixed(M < 100 ? 1 : 0)} M`;
}

export function createWorlds(ctx, opts = {}) {
  const THREE = ctx.THREE;
  const ship = ctx.ship;
  const kerr = ctx.kerr;
  const K = ctx.K || { a: 0.95, rp: 1.312, rm: 0.688 };
  let quality = opts.quality || 'full';          // 'full' | 'fast' — body shaders read uQuality; ATMO_STEPS is fixed at material creation
  const catalog = { bodies: BODIES, byId, LIGHT, KM_PER_M };

  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 1. orbits & frames
  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  const poleOf = (b) => { const f = b.frame, t = f.tilt * DEG, a = f.azimuth * DEG; return [Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t)]; };
  const orb = {};
  for (const b of BODIES) {
    if (!b.orbit) continue;
    let inc = b.orbit.inc * DEG, node = b.orbit.node * DEG;
    if (b.orbit.equatorOf) {
      const pole = poleOf(byId[b.orbit.equatorOf]);
      inc = Math.acos(pole[2]); node = Math.atan2(pole[0], -pole[1]);
    }
    const ci = Math.cos(inc), si = Math.sin(inc), cn = Math.cos(node), sn = Math.sin(node);
    orb[b.id] = { inc, P: [cn, sn, 0], Q: [-sn * ci, cn * ci, si], N: [sn * si, -cn * si, ci] };
  }
  const omegaOf = (b) => {
    const o = b.orbit;
    if (o.period) return TAU / o.period;
    return 1 / (Math.pow(o.r, 1.5) + (K.a || 0) * Math.cos(orb[b.id].inc));
  };
  function posAt(b, t) {
    if (b.fixed) { const f = b.fixed; return [f.pos[0] + f.vel[0] * t, f.pos[1] + f.vel[1] * t, f.pos[2] + f.vel[2] * t]; }
    const o = b.orbit, ob = orb[b.id], th = o.phase * DEG + omegaOf(b) * t, c = Math.cos(th) * o.r, s = Math.sin(th) * o.r;
    const p = [c * ob.P[0] + s * ob.Q[0], c * ob.P[1] + s * ob.Q[1], c * ob.P[2] + s * ob.Q[2]];
    if (o.parent) { const q = posAt(byId[o.parent], t); p[0] += q[0]; p[1] += q[1]; p[2] += q[2]; }
    return p;
  }
  function velAt(b, t) {
    if (b.fixed) return b.fixed.vel.slice();
    const o = b.orbit, ob = orb[b.id], w = omegaOf(b), th = o.phase * DEG + w * t, c = Math.cos(th) * o.r * w, s = Math.sin(th) * o.r * w;
    const v = [-s * ob.P[0] + c * ob.Q[0], -s * ob.P[1] + c * ob.Q[1], -s * ob.P[2] + c * ob.Q[2]];
    if (o.parent) { const q = velAt(byId[o.parent], t); v[0] += q[0]; v[1] += q[1]; v[2] += q[2]; }
    return v;
  }
  // Euclidean body-fixed axes (X, Y, Z) as KS coordinate vectors — see catalog header
  function axesAt(b, t) {
    const f = b.frame;
    switch (f.type) {
      case 'orbit': {
        const p = posAt(b, t), Z = unit(p), n = orb[b.id].N;
        const Y = unit(sub(n, mul(Z, dot(Z, n))));
        return [cross(Y, Z), Y, Z];
      }
      case 'locked': {
        const p = posAt(b, t), tg = f.to === 'erebus' ? [0, 0, 0] : posAt(byId[f.to], t);
        const X = unit(sub(tg, p)), n = orb[b.id].N;
        const Z = unit(sub(n, mul(X, dot(X, n))));
        return [X, cross(Z, X), Z];
      }
      case 'spin': {
        const Z = poleOf(b);
        const ref = Math.abs(Z[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        const X0 = unit(cross(Z, ref)), Y0 = cross(Z, X0);
        const ang = (b.spinPeriod ? (TAU * t) / b.spinPeriod : 0) + 0.7, c = Math.cos(ang), s = Math.sin(ang);
        const X = add(mul(X0, c), mul(Y0, s));
        return [X, cross(Z, X), Z];
      }
      case 'galaxy': {
        const Cg = LIGHT.galaxyDir, zz = [0, 0, 1];
        const Z = unit(sub(zz, mul(Cg, dot(Cg, zz))));
        return [Cg.slice(), cross(Z, Cg), Z];
      }
      case 'fixed': {
        const F = unit(f.forward), U = unit(sub(f.up, mul(F, dot(F, f.up)))), R = cross(F, U);
        return [R, U, mul(F, -1)];
      }
      default: return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    }
  }
  const _S2 = new Float64Array(20), _V4 = new Float64Array(4), _W4 = new Float64Array(4), _X4 = new Float64Array(4), _Ub = new Float64Array(4);
  // body axes as g-orthonormal 4-vectors in the body's rest frame (the exact basis a rigid body carries)
  function axesOrtho4(b, t, pos) {
    const ax = axesAt(b, t), p = pos || posAt(b, t), v = velAt(b, t), s = b.sheet;
    _V4[0] = 1; _V4[1] = v[0]; _V4[2] = v[1]; _V4[3] = v[2];
    const n = Math.sqrt(Math.max(1e-12, -kerr.gdot([t, p[0], p[1], p[2]], s, _V4, _V4)));
    _S2.fill(0);
    _S2[0] = t; _S2[1] = p[0]; _S2[2] = p[1]; _S2[3] = p[2];
    for (let m = 0; m < 4; m++) _S2[4 + m] = _V4[m] / n;
    for (let i = 0; i < 3; i++) { _S2[9 + 4 * i] = ax[i][0]; _S2[10 + 4 * i] = ax[i][1]; _S2[11 + 4 * i] = ax[i][2]; }
    kerr.orthonormalize(_S2, s);
    return [0, 1, 2].map((i) => [_S2[8 + 4 * i], _S2[9 + 4 * i], _S2[10 + 4 * i], _S2[11 + 4 * i]]);
  }
  // 4-velocity of the body's rest frame, normalised at the ship's position X
  function bodyU(b, t, X, out) {
    const v = velAt(b, t);
    _V4[0] = 1; _V4[1] = v[0]; _V4[2] = v[1]; _V4[3] = v[2];
    const n = Math.sqrt(Math.max(1e-12, -kerr.gdot(X, b.sheet, _V4, _V4)));
    for (let m = 0; m < 4; m++) out[m] = _V4[m] / n;
    return out;
  }
  const siteOf = (b, id) => b.sites.find((s) => s.id === id) || b.sites[0] || null;
  // site frame as coefficient triples in the body-fixed (X,Y,Z) basis
  function siteCoefs(site) {
    const la = site.lat * DEG, lo = site.lon * DEG, cl = Math.cos(la), sl = Math.sin(la), co = Math.cos(lo), so = Math.sin(lo);
    return { n: [cl * co, cl * so, sl], east: [-so, co, 0], north: [-sl * co, -sl * so, cl] };
  }
  const g4 = (X, s, a, b) => kerr.gdot(X, s, a, b);

  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 2. per-frame body state / view geometry
  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  const ST = {};
  for (const b of BODIES) ST[b.id] = { b, id: b.id, present: false, dist: Infinity, distRet: Infinity, holding: false, wasFar: false, betaRel: 0, discovered: false, lag: 0 };
  const mesh = { halcyon: null, eurydice: null };      // exterior meshes { group, port, update, placeholder, attached }
  let stamp = NaN;
  let wall = 0;

  const present = (b) => ship.universe === 0 && ship.sheet === b.sheet;
  const portOf = (b) => { const m = mesh[b.id]; return (m && m.port) || b.port; };
  function orpheusPort() {
    const d = ctx.shipModel && ctx.shipModel.airlock && ctx.shipModel.airlock.dock;
    return d && d.pos && d.normal ? { pos: d.pos, normal: d.normal } : { pos: [-1.45, -0.2, 16.0], normal: [-1, 0, 0] };
  }
  // guidance goal: planets → centre; dockables → the approach point in front of the port
  function goalPos(b, t) {
    const c = posAt(b, t);
    if (!b.dockable) return c;
    const pt = portOf(b), ax = axesAt(b, t);
    return add(c, comb(ax, mul(add(pt.pos, mul(unit(pt.normal), b.approachGap * MPM)), 1 / MPM)));
  }

  // ship-space (x = right, y = up, z = −forward) vector of a KS 4-vector / spatial 3-vector
  function shipVec4(v4, out) {
    const c = kerr.toBody(v4, ship.S, _X4, ship.sheet);
    out[0] = c[0]; out[1] = c[1]; out[2] = -c[2];
    return out;
  }
  const _t4 = new Float64Array(4);
  function shipVec3(w, out) { _t4[0] = 0; _t4[1] = w[0]; _t4[2] = w[1]; _t4[3] = w[2]; return shipVec4(_t4, out); }
  const shipUnit3 = (w) => unit(shipVec3(w, [0, 0, 0]));
  const shipUnit4 = (v) => unit(shipVec4(v, [0, 0, 0]));

  // apparent (aberrated) circle of a sphere of radius R at coordinate displacement Dv, in body components
  function apparentCircle(Dv, R) {
    const d = len(Dv);
    if (d <= R * 1.0002) return null;
    const Dh = [Dv[0] / d, Dv[1] / d, Dv[2] / d];
    const e = unit(cross(Dh, Math.abs(Dh[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    const tl = Math.sqrt(d * d - R * R), ca = tl / d, sa = R / d;
    const P1 = [tl * (ca * Dh[0] + sa * e[0]), tl * (ca * Dh[1] + sa * e[1]), tl * (ca * Dh[2] + sa * e[2])];
    const P2 = [tl * (ca * Dh[0] - sa * e[0]), tl * (ca * Dh[1] - sa * e[1]), tl * (ca * Dh[2] - sa * e[2])];
    const n1 = kerr.apparentBody(P1), n2 = kerr.apparentBody(P2);
    const cr = cross(n1, n2), c = dot(n1, n2);
    const ang = Math.atan2(len(cr), c);
    const center = c < -0.999 ? kerr.apparentBody(Dv) : unit(add(n1, n2));
    return { center, ang: ang * 0.5 };
  }

  function refresh(force) {
    const S = ship.S;
    const h = S[0] + S[1] * 1.7 + S[2] * 2.3 + S[3] * 3.1 + S[4] * 5.7 + S[5] * 7.1 + S[6] * 11 + S[7] * 13 + S[8] * 17 + S[9] * 19 + S[10] * 23 + S[12] * 29 + S[16] * 31 + ship.sheet * 37 + ship.universe * 41 + (ship.lock ? 43 : 0);
    if (!force && h === stamp) return;
    stamp = h;
    const t = S[0], s = ship.sheet;
    _X4[0] = t; _X4[1] = S[1]; _X4[2] = S[2]; _X4[3] = S[3];
    const X4 = _X4, shipPos = [S[1], S[2], S[3]];
    for (const b of BODIES) {
      const st = ST[b.id];
      st.present = present(b);
      const p = posAt(b, t), D = sub(p, shipPos);
      st.pos = p; st.D = D; st.dist = len(D); st.altM = st.dist - b.radius;
      if (!st.present) { st.holding = false; continue; }
      bodyU(b, t, X4, _Ub);
      { const d4 = [0, 0, 0, 0]; for (let m = 0; m < 4; m++) d4[m] = S[4 + m] - _Ub[m]; st.betaRel = Math.sqrt(Math.max(0, kerr.gdot(X4, s, d4, d4))); }
      // retarded view (light travel time at c = 1)
      let tr = t;
      for (let i = 0; i < 4; i++) { const q = posAt(b, tr); tr = t - Math.hypot(q[0] - S[1], q[1] - S[2], q[2] - S[3]); }
      const pr = posAt(b, tr), Dr = sub(pr, shipPos), dr = len(Dr);
      st.tr = tr; st.lag = t - tr; st.Dret = Dr; st.distRet = dr;
      const circ = apparentCircle(Dr, b.radius);
      st.dirCenter = kerr.apparentBody(Dr);                      // image of the body's centre point (meshes, HUD)
      st.dirCenterShip = [st.dirCenter[0], st.dirCenter[1], -st.dirCenter[2]];
      if (circ) { st.angRad = circ.ang; st.dirBody = circ.center; }  // centre of the aberrated limb circle (analytic discs)
      else { st.angRad = Math.PI / 2; st.dirBody = st.dirCenter; }
      st.dirShip = [st.dirBody[0], st.dirBody[1], -st.dirBody[2]];
      { const dx4 = [t - tr, -Dr[0], -Dr[1], -Dr[2]]; st.Lship = Math.max(1e-12, -kerr.gdot(X4, s, dx4, S.subarray(4, 8))); }
      // axes / light at the retarded time
      const ox = axesOrtho4(b, tr, pr);
      st.axes = ox.map(shipUnit4);
      let sunKs, dSun;
      if (b.sheet > 0) { sunKs = unit(mul(pr, -1)); dSun = len(pr); } else { sunKs = LIGHT.galaxyDir; dSun = 1e9; }
      st.dSun = dSun; st.sunKs = sunKs; st.sunShip = shipUnit3(sunKs);
      st.phaseCos = dot(unit(mul(Dr, -1)), sunKs);                       // 1 = full (observer on the lit side)
      if (b.frame.type === 'locked' && b.frame.to !== 'erebus') {
        const par = byId[b.frame.to], pp = posAt(par, tr), toP = sub(pp, pr), dP = len(toP);
        st.parentShip = shipUnit3(toP); st.parentAng = Math.asin(clamp(par.radius / dP, 0, 1));
        st.parentSunDist = len(pp); st.parentPhase = dot(unit(mul(toP, -1)), unit(mul(pp, -1)));
      } else st.parentShip = null;
      if (b.rings) st.poleShip = st.axes[2];
      // holding (arrival) detection with hysteresis
      // planets: within 1.6 standoff radii of the centre; dockables: near the approach point in front of the port
      const dHold = b.dockable ? len(sub(goalPos(b, t), shipPos)) : st.dist;
      const holdR = b.dockable ? Math.max(300, 2 * b.approachGap * MPM) / MPM : b.standoff * 1.6;
      const betaMax = b.dockable ? 2.2e-8 : clamp(0.02 * st.dist, 2e-6, 4e-3);
      const near = dHold <= holdR && st.betaRel <= betaMax;
      const stay = dHold <= holdR * 2.5 && st.betaRel <= betaMax * 6;
      st.holding = (st.holding ? stay : near) && !ship.lock;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 3. far-pass rendering
  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  const gl = { ready: false, mats: {}, size: new THREE.Vector2() };
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  function initGL() {
    if (gl.ready) return;
    gl.quad = new THREE.PlaneGeometry(2, 2);
    gl.cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1e9);
    gl.dummy = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    gl.dummy.needsUpdate = true;
    gl.bh = { uBhTex: { value: gl.dummy }, uBhOn: { value: 0 } };
    gl.occ = { uPathM: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
    gl.baseBlend = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
    gl.spriteMat = new THREE.ShaderMaterial({
      vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG,
      uniforms: { uRect: { value: new THREE.Vector4() }, uColor: { value: V3() }, uSigmaN: { value: 0.2 }, uBhOn: gl.bh.uBhOn, uBhTex: gl.bh.uBhTex, uPathM: { value: 0 }, uSpike: { value: 0 } },
      ...gl.baseBlend, blendDst: THREE.OneFactor,
    });
    gl.plasmaMat = new THREE.ShaderMaterial({
      vertexShader: SPRITE_VERT, fragmentShader: PLASMA_FRAG,
      uniforms: { uRect: { value: new THREE.Vector4(-1, -1, 1, 1) }, uPlasma: { value: 0 }, uTime: { value: 0 }, uCol: { value: V3(1.0, 0.36, 0.10) } },
      ...gl.baseBlend, blendDst: THREE.OneFactor,
    });
    gl.mesh = new THREE.Mesh(gl.quad, gl.spriteMat);
    gl.mesh.frustumCulled = false;
    gl.scene = new THREE.Scene();
    gl.scene.add(gl.mesh);
    gl.meshScene = new THREE.Scene();
    gl.sun = new THREE.DirectionalLight(0xffffff, 1);
    gl.fill = new THREE.HemisphereLight(0x8aa0c8, 0x10121a, 0.1);
    gl.meshScene.add(gl.sun, gl.sun.target, gl.fill);
    gl.ready = true;
    for (const id of ['halcyon', 'eurydice']) if (mesh[id]) attachMesh(id);
  }

  function discMaterial(b) {
    if (gl.mats[b.id]) return gl.mats[b.id];
    const sh = SHADERS[b.id] || SHADERS.generic;
    const defines = { ...(sh.defines || {}), ATMO_STEPS: quality === 'fast' ? 6 : 10 };
    if (b.rings) { defines.HAS_RINGS = 1; defines.RING_OUT = b.rings.outer.toFixed(3); }
    const u = {
      uRect: { value: new THREE.Vector4(-1, -1, 1, 1) }, uTanHalf: { value: 1 }, uAspect: { value: 1 }, uPixAng: { value: 0.001 },
      uC: { value: V3(0, 0, -10) }, uAx: { value: V3(1, 0, 0) }, uAy: { value: V3(0, 1, 0) }, uAz: { value: V3(0, 0, 1) },
      uSun: { value: V3(0, 0, 1) }, uSunRad: { value: V3(1, 1, 1) }, uSunSoft: { value: 0.05 }, uAmb: { value: V3(0.002, 0.002, 0.002) },
      uBeta: { value: V3(14, 35, 75) }, uBetaMie: { value: 0 }, uHs: { value: 0.0033 }, uAtmoTop: { value: 0 },
      uEmit: { value: 1 }, uTime: { value: 0 }, uDistScale: { value: 1 }, uBhOn: gl.bh.uBhOn, uBhTex: gl.bh.uBhTex,
      uRingN: { value: V3(0, 1, 0) }, uRingR: { value: new THREE.Vector2(1.3, 2.0) },
      uParentDir: { value: V3(0, 1, 0) }, uParentRad: { value: V3() },
      uP0: { value: new THREE.Vector4() }, uP1: { value: new THREE.Vector4() }, uP2: { value: new THREE.Vector4() }, uP3: { value: new THREE.Vector4() },
      uQuality: { value: quality === 'fast' ? 0 : 1 }, uFade: { value: 1 },
    };
    const params = (sh.params && sh.params(b.look, b)) || {};
    for (const k of Object.keys(params)) if (u[k]) u[k].value.set(...params[k]);
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: buildFragment(sh.glsl, defines), uniforms: u, ...gl.baseBlend });
    gl.mats[b.id] = mat;
    return mat;
  }

  function targetSize(renderer, out) {
    const rt = renderer.getRenderTarget && renderer.getRenderTarget();
    if (rt) out.set(rt.width, rt.height); else renderer.getDrawingBufferSize(out);
    return out;
  }

  const qInv = new THREE.Quaternion();
  const tv = new THREE.Vector3();
  function toCam(v3) { tv.set(v3[0], v3[1], v3[2]).applyQuaternion(qInv); return [tv.x, tv.y, tv.z]; }

  // light on a body: radiance of a white face-on surface (exposure + far-pass auto-gain included)
  function lightFor(b, st, ex) {
    let white, col, soft;
    if (b.sheet > 0) {
      const d = Math.max(st.dSun, 8);
      white = LIGHT.white140 * Math.pow(LIGHT.refDist / d, 2); col = LIGHT.col; soft = Math.atan(LIGHT.srcRadiusM / d);
    } else { white = LIGHT.galaxyWhite; col = LIGHT.galaxyCol; soft = LIGHT.galaxyAngRadius; }
    const maxWhite = b.dockable ? 2.2 : 3.0;
    let k = ex;
    const disp = ex * white;
    if (disp < LIGHT.adaptTarget) k = ex * Math.min(LIGHT.adaptMax, Math.pow(LIGHT.adaptTarget / Math.max(disp, 1e-6), 0.88));
    k = Math.min(k, maxWhite / white);
    return { white, k, col, soft, rad: [col[0] * white * k, col[1] * white * k, col[2] * white * k] };
  }

  function ndcOf(dir, tanHalf, aspect, out) {
    if (dir[2] > -1e-4) return false;
    out[0] = dir[0] / (-dir[2] * tanHalf * aspect); out[1] = dir[1] / (-dir[2] * tanHalf);
    return true;
  }
  // screen rectangle of the bounding cone (24 limb samples), falling back to the full screen
  function discRect(c, Deff, Rb, tanHalf, aspect, rect) {
    rect.set(-1, -1, 1, 1);
    const sinA = Rb / Deff;
    if (sinA >= 0.5) return;
    const ab = Math.asin(sinA);
    const e1 = unit(cross(c, Math.abs(c[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = cross(c, e1);
    const ca = Math.cos(ab), sa = Math.sin(ab);
    let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
    const o = [0, 0];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU, co = Math.cos(a), si = Math.sin(a);
      const d = [ca * c[0] + sa * (co * e1[0] + si * e2[0]), ca * c[1] + sa * (co * e1[1] + si * e2[1]), ca * c[2] + sa * (co * e1[2] + si * e2[2])];
      if (!ndcOf(d, tanHalf, aspect, o)) return;
      x0 = Math.min(x0, o[0]); x1 = Math.max(x1, o[0]); y0 = Math.min(y0, o[1]); y1 = Math.max(y1, o[1]);
    }
    const padx = 0.05 * (x1 - x0) + 0.01, pady = 0.05 * (y1 - y0) + 0.01;
    x0 = Math.max(-1, x0 - padx); x1 = Math.min(1, x1 + padx); y0 = Math.max(-1, y0 - pady); y1 = Math.min(1, y1 + pady);
    if (x1 <= x0 || y1 <= y0) { rect.set(0, 0, 0, 0); return; }
    rect.set(x0, y0, x1, y1);
  }

  function drawDisc(renderer, st, view, fade) {
    const b = st.b, mat = discMaterial(b), u = mat.uniforms;
    const Deff = 1 / Math.sin(Math.min(st.angRad, 1.5));
    const c = toCam(st.dirShip);
    const Rb = Math.max(1 + (b.atmosphere ? b.atmosphere.height : 0), b.rings ? b.rings.outer : 1);
    discRect(c, Deff, Rb, view.tanHalf, view.aspect, u.uRect.value);
    if (u.uRect.value.x === u.uRect.value.z) return;
    const lf = lightFor(b, st, view.exposure);
    u.uTanHalf.value = view.tanHalf; u.uAspect.value = view.aspect; u.uPixAng.value = view.pixAng;
    u.uC.value.set(c[0] * Deff, c[1] * Deff, c[2] * Deff);
    const ax = st.axes.map(toCam);
    u.uAx.value.set(...ax[0]); u.uAy.value.set(...ax[1]); u.uAz.value.set(...ax[2]);
    u.uSun.value.set(...toCam(st.sunShip));
    u.uSunRad.value.set(...lf.rad);
    u.uSunSoft.value = lf.soft;
    const ambK = lf.white * lf.k * 0.022 + 0.0016;
    u.uAmb.value.set(ambK * 0.8, ambK * 0.9, ambK * 1.15);
    const at = b.atmosphere;
    if (at) {
      const col = at.color, kb = 85 * (at.density ?? 1);
      u.uBeta.value.set(kb * Math.pow(col[0], 1.4), kb * Math.pow(col[1], 1.4), kb * Math.pow(col[2], 1.4));
      u.uBetaMie.value = at.haze * 22 * (at.density ?? 1); u.uHs.value = at.height / 6; u.uAtmoTop.value = at.height;
    } else { u.uAtmoTop.value = 0; u.uBetaMie.value = 0; u.uHs.value = 0.003; }
    u.uEmit.value = 1;
    u.uTime.value = ship.S[0];
    u.uDistScale.value = st.distRet / Deff;
    if (b.rings) { u.uRingN.value.set(...toCam(st.poleShip)); u.uRingR.value.set(b.rings.inner, b.rings.outer); }
    if (st.parentShip) {
      u.uParentDir.value.set(...toCam(st.parentShip));
      const par = byId[b.frame.to], whiteP = LIGHT.white140 * Math.pow(LIGHT.refDist / Math.max(st.parentSunDist, 8), 2);
      const sa = Math.sin(st.parentAng), phase = 0.5 * (1 + st.parentPhase);
      const k = par.look.albedo * whiteP * sa * sa * phase * lf.k;
      const pc = b.look.parentShine || [1, 1, 1];
      u.uParentRad.value.set(k * pc[0], k * pc[1], k * pc[2]);
    } else u.uParentRad.value.set(0, 0, 0);
    u.uFade.value = fade;
    u.uQuality.value = quality === 'fast' ? 0 : 1;
    gl.mesh.material = mat;
    renderer.render(gl.scene, gl.cam);
  }

  function drawSprite(renderer, st, view, color, sigmaPx, spike, distM, dir) {
    const o = [0, 0];
    const c = toCam(dir || st.dirShip);
    if (!ndcOf(c, view.tanHalf, view.aspect, o)) return;
    if (Math.abs(o[0]) > 1.2 || Math.abs(o[1]) > 1.2) return;
    const hs = 5 * sigmaPx + 2;
    const hx = (hs * 2) / view.W, hy = (hs * 2) / view.H;
    const u = gl.spriteMat.uniforms;
    u.uRect.value.set(o[0] - hx, o[1] - hy, o[0] + hx, o[1] + hy);
    u.uColor.value.set(color[0], color[1], color[2]);
    u.uSigmaN.value = sigmaPx / hs;
    u.uSpike.value = spike;
    u.uPathM.value = distM;
    gl.mesh.material = gl.spriteMat;
    renderer.render(gl.scene, gl.cam);
  }

  const lambertPhase = (cosPsi) => { const psi = Math.acos(clamp(cosPsi, -1, 1)); return (Math.sin(psi) + (Math.PI - psi) * Math.cos(psi)) / Math.PI; };
  // sub-pixel worlds read as wandering stars: reflected disk light, phase dependent, with a legibility floor
  function drawPointBody(renderer, st, view, lf) {
    const b = st.b;
    const phase = lambertPhase(st.phaseCos);
    const Lavg = (2 / 3) * b.look.albedo * (0.2126 * lf.rad[0] + 0.7152 * lf.rad[1] + 0.0722 * lf.rad[2]) * phase;
    const flux = Lavg * Math.PI * st.angRad * st.angRad;
    const sigma = 0.7;
    const peakPhys = flux / (TAU * sigma * sigma * view.pixAng * view.pixAng);
    const distF = clamp(Math.pow(250 / Math.max(st.dist, 1), 0.5), 0.35, 1);
    const floor = 1.05 * (0.25 + 0.75 * Math.sqrt(phase)) * distF * (b.kind === 'gasgiant' ? 1.4 : 1);
    const peak = Math.min(4, Math.max(peakPhys, floor));
    const col = b.look.color, m = Math.max(col[0], col[1], col[2], 1e-3), lc = lf.col;
    drawSprite(renderer, st, view, [peak * (col[0] / m) * (0.6 + 0.4 * lc[0]), peak * (col[1] / m) * (0.6 + 0.4 * lc[1]), peak * (col[2] / m) * (0.6 + 0.4 * lc[2])], sigma, peak > 0.4 ? 0.22 : 0, st.distRet);
  }
  function beaconColor(b) {
    const col = b.look.beacon || [1, 1, 1];
    let pulse;
    if (b.id === 'halcyon') { const ph = wall % 2.4; pulse = ((ph < 0.09 ? 1 : 0) + (ph > 0.22 && ph < 0.31 ? 0.8 : 0)) * 1.4 + 0.18; }
    else pulse = (0.12 + 0.88 * Math.pow(0.5 + 0.5 * Math.sin(wall * (TAU / 3.4)), 3)) * 0.9;
    return [col[0] * pulse * 1.5, col[1] * pulse * 1.5, col[2] * pulse * 1.5];
  }

  // 3D station / derelict ───────────────────────────────────────────────────────────────────────────────────────────
  // chained in-place patch (keeps the model's own onBeforeCompile hooks, e.g. the ship hull's frost shader)
  function patchOcclusion(m) {
    if (m.userData && m.userData._bhocc) return m;
    m.userData = m.userData || {}; m.userData._bhocc = 1;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    m.onBeforeCompile = function (shader, renderer) {
      if (prev) prev.call(m, shader, renderer);
      shader.uniforms.uBhTex = gl.bh.uBhTex; shader.uniforms.uBhOn = gl.bh.uBhOn;
      shader.uniforms.uPathM = gl.occ.uPathM; shader.uniforms.uResOcc = gl.occ.uRes;
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'uniform sampler2D uBhTex; uniform float uBhOn, uPathM; uniform vec2 uResOcc;\nvoid main() {\n  if (uBhOn > 0.5 && uPathM > texture2D(uBhTex, gl_FragCoord.xy/uResOcc).a*1.002 + 0.002) discard;');
    };
    m.customProgramCacheKey = () => prevKey + '|bhocc';
    m.needsUpdate = true;
    return m;
  }
  function attachMesh(id) {
    const m = mesh[id];
    if (!m || !gl.ready || m.attached) return;
    m.group.traverse((o) => {
      if (!o.isMesh && !o.isLine && !o.isPoints) return;
      if (Array.isArray(o.material)) o.material = o.material.map(patchOcclusion);
      else if (o.material) o.material = patchOcclusion(o.material);
    });
    m.group.visible = false;
    gl.meshScene.add(m.group);
    m.attached = true;
  }
  function setMesh(id, group, port, update, placeholder) {
    const old = mesh[id];
    if (old && old.attached) gl.meshScene.remove(old.group);
    mesh[id] = { group, port: port || null, update: update || null, attached: false, placeholder: !!placeholder };
    if (gl.ready) attachMesh(id);
    stamp = NaN;
  }

  const _mtx = new THREE.Matrix4(), _vx = new THREE.Vector3(), _vy = new THREE.Vector3(), _vz = new THREE.Vector3();
  function drawMesh(renderer, st, view, lf) {
    const b = st.b, m = mesh[b.id];
    if (!m || !gl.ready || !m.attached) return false;
    const distMm = st.Lship * MPM, dirS = st.dirCenterShip;
    const g = m.group;
    for (const id of ['halcyon', 'eurydice']) if (mesh[id] && mesh[id].group) mesh[id].group.visible = id === b.id;
    g.position.set(dirS[0] * distMm - view.camPos.x, dirS[1] * distMm - view.camPos.y, dirS[2] * distMm - view.camPos.z);
    _mtx.makeBasis(_vx.set(...st.axes[0]), _vy.set(...st.axes[1]), _vz.set(...st.axes[2]));
    g.quaternion.setFromRotationMatrix(_mtx);
    g.updateMatrixWorld(true);
    const sunS = st.sunShip;
    gl.sun.position.set(sunS[0] * 1000, sunS[1] * 1000, sunS[2] * 1000);
    gl.sun.target.position.set(0, 0, 0);
    gl.sun.color.setRGB(lf.col[0], lf.col[1], lf.col[2]);
    gl.sun.intensity = Math.PI * lf.white * lf.k;
    gl.fill.intensity = Math.PI * lf.white * lf.k * (b.sheet < 0 ? 0.16 : 0.06) + 0.02;
    gl.occ.uPathM.value = st.distRet;
    if (g.userData && typeof g.userData.setExposure === 'function') g.userData.setExposure(lf.k);
    gl.cam.near = Math.max(0.05, distMm * 1e-4); gl.cam.far = distMm * 4 + 5000;
    gl.cam.fov = view.fov; gl.cam.aspect = view.aspect;
    gl.cam.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.render(gl.meshScene, gl.cam);
    return true;
  }

  let plasmaAmt = 0;
  function renderFar(renderer, cam) {
    initGL();
    refresh(true);
    if (ship.sheet < 0) loadModel('eurydice');
    wall = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 1e-3;
    const size = targetSize(renderer, gl.size);
    const W = size.x, H = size.y;
    const tanHalf = Math.tan(cam.fov * DEG * 0.5), aspect = cam.aspect || W / H;
    const view = { W, H, fov: cam.fov, aspect, tanHalf, pixAng: (2 * tanHalf) / H, exposure: (cam.exposure !== undefined ? cam.exposure : (ctx.view && ctx.view.exposure)) || 1, camPos: cam.position || V3() };
    qInv.copy(cam.quaternion).invert();
    gl.cam.quaternion.copy(cam.quaternion);
    gl.cam.position.set(0, 0, 0);
    gl.cam.fov = cam.fov; gl.cam.aspect = aspect; gl.cam.near = 0.1; gl.cam.far = 1e9;
    gl.cam.updateProjectionMatrix(); gl.cam.updateMatrixWorld(true);
    gl.occ.uRes.value.set(W, H);
    gl.bh.uBhTex.value = cam.bhTex || gl.dummy;
    gl.bh.uBhOn.value = cam.bhTex ? 1 : 0;
    const list = [];
    for (const b of BODIES) { const st = ST[b.id]; if (st.present && cam.skip !== b.id) list.push(st); }
    list.sort((a, c) => c.distRet - a.distRet);
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    for (const st of list) {
      const b = st.b, lf = lightFor(b, st, view.exposure);
      if (b.dockable) {
        if (st.Lship * KM_PER_M <= b.meshRangeKm && drawMesh(renderer, st, view, lf)) continue;
        drawSprite(renderer, st, view, beaconColor(b), 0.95, 0.5, st.distRet, st.dirCenterShip);
        continue;
      }
      const angPx = st.angRad / view.pixAng;
      if (angPx < 2.2) drawPointBody(renderer, st, view, lf);
      if (angPx > 0.7) drawDisc(renderer, st, view, smooth01((angPx - 0.7) / 0.9));
    }
    if (plasmaAmt > 0.002) {
      const u = gl.plasmaMat.uniforms;
      u.uPlasma.value = plasmaAmt; u.uTime.value = wall;
      gl.mesh.material = gl.plasmaMat;
      renderer.render(gl.scene, gl.cam);
    }
    renderer.autoClear = prevAuto;
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 4. locks: landed / descent / ascent / docked / docking
  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  const quatFrom = (m3) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...m3[0]), new THREE.Vector3(...m3[1]), new THREE.Vector3(...m3[2])));
  const applyQ = (q, v) => new THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(q).toArray();
  const coefs = (ax, w) => [dot(w, ax[0]), dot(w, ax[1]), dot(w, ax[2])];          // Euclidean body coordinates of a displacement
  const frameOf = (ox, T4, X, s) => [g4(X, s, T4, ox[0]), g4(X, s, T4, ox[1]), g4(X, s, T4, ox[2])];   // components of a rest-frame 4-vector
  const eyeHeight = () => { const g = ctx.shipModel && ctx.shipModel.landing && ctx.shipModel.landing.groundY; return typeof g === 'number' ? -g : 3.1; };

  function descentAlt(p, d0, dT) {
    const A = d0 - dT; let f;
    if (p < 0.55) { const s = p / 0.55; f = 1 - 0.97 * s * s * (3 - 2 * s); }
    else { const s = (p - 0.55) / 0.45; f = 0.03 * Math.pow(1 - s * s * (3 - 2 * s), 1.4); }
    return dT + A * f;
  }
  function slerpDir(a, c, e) {
    const om = Math.acos(clamp(dot(a, c), -1, 1));
    if (om < 1e-5) return unit(add(mul(a, 1 - e), mul(c, e)));
    const s = Math.sin(om);
    return unit(add(mul(a, Math.sin((1 - e) * om) / s), mul(c, Math.sin(e * om) / s)));
  }

  function landedPose(b, site, t, lock) {
    const ax = axesAt(b, t), ox = axesOrtho4(b, t), sc = siteCoefs(site);
    const hgt = (lock && lock.hover !== undefined ? lock.hover : eyeHeight()) / MPM;
    return { pos: add(posAt(b, t), comb(ax, mul(sc.n, b.radius + hgt))), F: comb4(ox, sc.north), R: comb4(ox, sc.east), Up: comb4(ox, sc.n) };
  }
  // descent (p: 0 → 1) over the site; used reversed for take-off
  function descentPose(b, site, t, lock, p) {
    const ax = axesAt(b, t), ox = axesOrtho4(b, t), sc = siteCoefs(site);
    const dT = b.radius + 40 / KM_PER_M;                         // 40 km above the site
    const u = slerpDir(lock.h.dir, sc.n, smooth01(p)), d = descentAlt(p, lock.h.d, dT);
    const pitch = 18 * DEG, cp = Math.cos(pitch), sp = Math.sin(pitch);
    const F1 = add(mul(sc.north, cp), mul(sc.n, -sp)), U1 = add(mul(sc.n, cp), mul(sc.north, sp));
    const q = lock.h.q.clone().slerp(quatFrom([sc.east, U1, mul(F1, -1)]), smooth01(p * 1.05));
    return {
      pos: add(posAt(b, t), comb(ax, mul(u, d))),
      F: comb4(ox, mul(applyQ(q, [0, 0, 1]), -1)), R: comb4(ox, applyQ(q, [1, 0, 0])), Up: comb4(ox, applyQ(q, [0, 1, 0])),
    };
  }
  // docking geometry in the station frame (metres): ship origin when the ports coincide + attitude Q (ship → station frame)
  function dockGeom(b) {
    const pt = portOf(b), os = orpheusPort();
    const N = unit(pt.normal), U0 = unit(pt.up || [0, 1, 0]);
    const U = unit(sub(U0, mul(N, dot(N, U0))));
    const A1 = unit(os.normal), A2 = unit(sub([0, 1, 0], mul(A1, dot(A1, [0, 1, 0])))), A3 = cross(A1, A2);
    const B1 = mul(N, -1), B2 = U, B3 = cross(B1, B2);
    const bm = new THREE.Matrix4().makeBasis(new THREE.Vector3(...B1), new THREE.Vector3(...B2), new THREE.Vector3(...B3));
    const am = new THREE.Matrix4().makeBasis(new THREE.Vector3(...A1), new THREE.Vector3(...A2), new THREE.Vector3(...A3));
    const Q = new THREE.Quaternion().setFromRotationMatrix(bm.multiply(am.transpose()));
    return { Q, E0: sub(pt.pos, applyQ(Q, os.pos)), N };
  }
  function dockPose(b, t, lock, p) {
    const g = dockGeom(b), ax = axesAt(b, t), ox = axesOrtho4(b, t);
    let gap = 0, lat = [0, 0, 0], q = g.Q;
    if (lock.kind === 'docking') {
      const split = 0.58;
      gap = p < split ? lerp(lock.g0, 40, smooth01(p / split)) : 40 * (1 - smooth01((p - split) / (1 - split)));
      lat = mul(lock.lat0, 1 - smooth01(p / 0.62));
      q = lock.q0.clone().slerp(g.Q, smooth01(p / 0.62));
    }
    const E = add(add(g.E0, mul(g.N, gap)), lat);
    return { pos: add(posAt(b, t), comb(ax, mul(E, 1 / MPM))), F: comb4(ox, mul(applyQ(q, [0, 0, 1]), -1)), R: comb4(ox, applyQ(q, [1, 0, 0])), Up: comb4(ox, applyQ(q, [0, 1, 0])) };
  }
  function poseOf(lock, t) {
    const b = byId[lock.body];
    switch (lock.kind) {
      case 'descent': return descentPose(b, siteOf(b, lock.site), t, lock, lock.p);
      case 'ascent': return descentPose(b, siteOf(b, lock.site), t, lock, 1 - lock.p);
      case 'docking': return dockPose(b, t, lock, lock.p);
      case 'docked': case 'undocking': return dockPose(b, t, lock, 1);
      default: return landedPose(b, siteOf(b, lock.site), t, lock);
    }
  }
  function lockState(lock, t, S) {
    const b = byId[lock.body];
    const pose = poseOf(lock, t);
    const hS = 0.25, pa = poseOf(lock, t - hS), pb = poseOf(lock, t + hS);
    const v = mul(sub(pb.pos, pa.pos), 1 / (2 * hS));
    _V4[0] = 1; _V4[1] = v[0]; _V4[2] = v[1]; _V4[3] = v[2];
    const n = Math.sqrt(Math.max(1e-12, -kerr.gdot([t, pose.pos[0], pose.pos[1], pose.pos[2]], b.sheet, _V4, _V4)));
    S[0] = t; S[1] = pose.pos[0]; S[2] = pose.pos[1]; S[3] = pose.pos[2];
    for (let m = 0; m < 4; m++) S[4 + m] = _V4[m] / n;
    for (let m = 0; m < 4; m++) { S[8 + m] = pose.F[m]; S[12 + m] = pose.R[m]; S[16 + m] = pose.Up[m]; }
    kerr.orthonormalize(S, b.sheet);
    return S;
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 5. flows: land / take off / dock / undock, arrival detection, lines
  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  const localFlags = {};
  const flags = ctx.flags || { once: (k, fn) => { if (!localFlags[k]) { localFlags[k] = 1; fn(); } }, get: (k) => localFlags[k], set: (k, v) => { localFlags[k] = v; } };
  const timers = [], waiters = [], siteIdx = {};
  let busy = false;
  const say = (id, o) => { if (id && ctx.say) { try { ctx.say(id, o); } catch (e) { console.warn('say', id, e); } } };
  const emit = (e, p) => { if (ctx.bus) ctx.bus.emit(e, p); };
  const unlockCodex = (b) => { if (ctx.codex && b.codex) { try { ctx.codex.unlock(b.codex); } catch (e) { /* optional */ } } };
  const mcReact = (id) => { if (id && ctx.mcReact && ship.sheet > 0 && ship.universe === 0) { try { ctx.mcReact(id); } catch (e) { /* optional */ } } };
  const after = (sec, fn) => timers.push({ t: sec, fn });
  const untilDone = (lock) => new Promise((res) => waiters.push({ lock, res }));
  const fade = (toBlack, ms) => (ctx.ui && ctx.ui.fade ? ctx.ui.fade(toBlack, ms) : Promise.resolve());
  const once = (key, fn) => flags.once(key, fn);

  const currentSite = (b) => (b.sites.length ? b.sites[(siteIdx[b.id] || 0) % b.sites.length] : null);
  function heldBody() {
    let best = null;
    for (const b of BODIES) { const st = ST[b.id]; if (st.present && st.holding && (!best || st.dist < ST[best.id].dist)) best = b; }
    return best;
  }
  const shipFrames = (S) => [S.slice(8, 12), S.slice(12, 16), S.slice(16, 20)];   // F, R, Up (4-vectors)

  function startDescent(b, siteId) {
    const S = ship.S, t = S[0], ax = axesAt(b, t), ox = axesOrtho4(b, t), X4 = [t, S[1], S[2], S[3]];
    const rel = sub([S[1], S[2], S[3]], posAt(b, t));
    const [F, R, Up] = shipFrames(S);
    const q = quatFrom([frameOf(ox, R, X4, b.sheet), frameOf(ox, Up, X4, b.sheet), mul(frameOf(ox, F, X4, b.sheet), -1)]);
    return { kind: 'descent', body: b.id, site: siteId, t0: t, p: 0, elapsed: 0, dur: 6.0, fx: {}, h: { dir: unit(coefs(ax, rel)), d: len(rel), q } };
  }

  async function doLand(b) {
    if (busy) return;
    busy = true;
    try {
      const site = currentSite(b), L = b.lines;
      const lock = startDescent(b, site.id);
      ship.lock = lock;
      say('cmdr.land');
      say(L.land, { delay: 1.4 });
      await untilDone(lock);
      await fade(true, 700);
      // the surface module builds its scene under the black screen, fades back in via onReady and plays its own landing animation
      let faded = false;
      const reveal = () => { if (!faded) { faded = true; fade(false, 900); } };
      if (ctx.surface && ctx.surface.enter) { try { await ctx.surface.enter(b.id, site.id, { onReady: reveal }); } catch (e) { console.error('[worlds] surface.enter failed', e); } }
      reveal();                                                  // fallback: enter threw / no surface module / onReady never called
      ship.lock = { kind: 'landed', body: b.id, site: site.id, h: lock.h };
      emit('land', { body: b.id, site: site.id });
      unlockCodex(b);
      say(L.surface, { delay: 1.0 });
    } finally { busy = false; plasmaAmt = 0; }
  }

  async function doTakeoff() {
    const cur = ship.lock;
    if (busy || !cur || cur.kind !== 'landed') return;
    busy = true;
    try {
      const b = byId[cur.body];
      say(b.lines.takeoff);
      // the surface module plays its visible lift-off; we go to black ~2.8 s in so the screen is dark when exit() resolves (~4 s)
      let blackP = null;
      const tmr = setTimeout(() => { blackP = fade(true, 700); }, 2800);
      if (ctx.surface && ctx.surface.exit) { try { await ctx.surface.exit(); } catch (e) { console.error('[worlds] surface.exit failed', e); } }
      clearTimeout(tmr);
      await (blackP || fade(true, 500));
      let h = cur.h;
      if (!h) {                          // no recorded hold point: 40° off the zenith, looking at the planet
        const sc = siteCoefs(siteOf(b, cur.site));
        const dirB = unit(add(mul(sc.n, Math.cos(0.7)), mul(sc.east, Math.sin(0.7))));
        const F = mul(dirB, -1), R = unit(cross(F, sc.north)), U = cross(R, F);
        h = { dir: dirB, d: b.standoff, q: quatFrom([R, U, mul(F, -1)]) };
      }
      const lock = { kind: 'ascent', body: b.id, site: cur.site, t0: ship.S[0], p: 0, elapsed: 0, dur: 5.5, fx: {}, h };
      ship.lock = lock;
      fade(false, 900);
      await untilDone(lock);
      ship.lock = null;                  // released at the hold point with the body's velocity
      emit('takeoff', { body: b.id });
    } finally { busy = false; plasmaAmt = 0; }
  }

  async function doDock(b) {
    if (busy) return;
    busy = true;
    try {
      const L = b.lines, S = ship.S, t = S[0], ax = axesAt(b, t), ox = axesOrtho4(b, t), X4 = [t, S[1], S[2], S[3]];
      say(L.cmdrDock);
      const g = dockGeom(b);
      const Em = mul(coefs(ax, sub([S[1], S[2], S[3]], posAt(b, t))), MPM);
      const d0 = sub(Em, g.E0);
      const gap0 = Math.max(40, dot(d0, g.N));
      const lat0 = sub(d0, mul(g.N, dot(d0, g.N)));
      const [F, R, Up] = shipFrames(S);
      const q0 = quatFrom([frameOf(ox, R, X4, b.sheet), frameOf(ox, Up, X4, b.sheet), mul(frameOf(ox, F, X4, b.sheet), -1)]);
      const lock = { kind: 'docking', body: b.id, t0: t, p: 0, elapsed: 0, dur: 10, fx: {}, g0: gap0, lat0, q0 };
      ship.lock = lock;
      await untilDone(lock);
      if (ctx.audio && ctx.audio.clank) ctx.audio.clank();
      ship.lock = { kind: 'docked', body: b.id };
      emit('dock', { body: b.id });
      unlockCodex(b);
      if (b.id === 'halcyon') mcReact(L.dock); else say(L.dock, { delay: 0.8 });
    } finally { busy = false; }
  }

  async function doUndock() {
    const cur = ship.lock;
    if (busy || !cur || cur.kind !== 'docked') return;
    busy = true;
    try {
      const b = byId[cur.body], S = ship.S, t = S[0];
      say(b.lines.cmdrUndock);
      lockState(cur, t, S);
      ship.lock = null;
      const nks = comb(axesAt(b, t), dockGeom(b).N), push = 0.5 / MPM;   // 0.5 m/s along the port normal
      for (let m = 0; m < 3; m++) S[5 + m] += nks[m] * push;
      kerr.orthonormalize(S, ship.sheet);
      emit('undock', { body: b.id });
      if (b.id === 'halcyon') mcReact(b.lines.undock);
    } finally { busy = false; }
  }

  function updateLockProgress(dt) {
    const lock = ship.lock;
    if (!lock || !lock.dur) { if (!lock) plasmaAmt = Math.max(0, plasmaAmt - dt * 2); return; }
    lock.elapsed += dt;
    const p = lock.p = clamp(lock.elapsed / lock.dur, 0, 1);
    const fx = ctx.fx, au = ctx.audio;
    if (lock.kind === 'descent') {
      plasmaAmt = smooth01((p - 0.38) / 0.4) * (1 - 0.5 * smooth01((p - 0.93) / 0.07));
      if (!lock.fx.whoosh) { lock.fx.whoosh = 1; if (au && au.whoosh) au.whoosh(1.4); }
      if (p > 0.84 && !lock.fx.boom) { lock.fx.boom = 1; if (au && au.boom) au.boom(1.2); }
      if (fx) {
        fx.shake = Math.max(fx.shake || 0, 0.3 + 2.4 * p * p);
        fx.glitch = Math.max(fx.glitch || 0, 0.12 + 0.9 * smooth01((p - 0.55) / 0.45));
        fx.flash = Math.max(fx.flash || 0, 0.04 + 0.28 * smooth01((p - 0.6) / 0.35) * (0.75 + 0.25 * Math.sin(wall * 38)));
        fx.flashCol = [1.0, 0.56, 0.24];
      }
    } else if (lock.kind === 'ascent') {
      plasmaAmt = 0.9 * (1 - smooth01(p / 0.7));
      if (!lock.fx.whoosh) { lock.fx.whoosh = 1; if (au && au.whoosh) au.whoosh(1.6); if (au && au.boom) au.boom(0.8); }
      if (fx) {
        fx.shake = Math.max(fx.shake || 0, 0.25 + 1.8 * (1 - p) * (1 - p));
        fx.flash = Math.max(fx.flash || 0, 0.2 * (1 - smooth01(p / 0.6)));
        fx.flashCol = [1.0, 0.6, 0.3];
      }
    } else if (lock.kind === 'docking') {
      if (!lock.fx.whoosh) { lock.fx.whoosh = 1; if (au && au.whoosh) au.whoosh(0.5); }
      if (fx && p > 0.9) fx.shake = Math.max(fx.shake || 0, 0.15);
    }
    if (p >= 1 && !lock.done) {
      lock.done = true;
      for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].lock === lock) waiters.splice(i, 1)[0].res();
    }
  }

  // ── story triggers ───────────────────────────────────────────────────────────────────────────────────────────────
  let antiTime = 0, lastT = NaN, scanCool = 0;
  function resetRun() {
    for (const id in ST) { ST[id].wasFar = false; ST[id].holding = false; }
    antiTime = 0; scanCool = 0; busy = false; plasmaAmt = 0;
    for (const k in siteIdx) delete siteIdx[k];
  }
  function discover(id) { if (ST[id]) ST[id].discovered = true; if (flags.set) flags.set('disc.' + id, true); }
  const isDiscovered = (id) => {
    const b = byId[id];
    if (b.group !== 'ANTIVERSE') return true;
    if (ST[id].discovered || (flags.get && flags.get('disc.' + id))) return true;
    return !!(ctx.codex && ctx.codex.isUnlocked && ctx.codex.isUnlocked(b.codex));
  };

  function triggers(dt) {
    const S = ship.S;
    if (Number.isFinite(lastT) && S[0] < lastT - 1e-6) resetRun();
    lastT = S[0];
    if (ship.universe !== 0) return;
    if (ship.sheet < 0) {                                 // Eurydice's transponder, 20 s into the negative universe
      antiTime += dt;
      if (antiTime >= 20) once('anti.beacon', () => { say('anti.beacon'); discover('eurydice'); });
    } else antiTime = 0;
    for (const b of BODIES) {
      const st = ST[b.id];
      if (!st.present) continue;
      if (st.dist > b.approachM * 1.12) st.wasFar = true;
      const L = b.lines;
      if (b.id === 'elysium' && st.dist < 70) discover('elysium');
      if (b.id === 'eurydice' && st.dist < 60) discover('eurydice');
      if (!ship.lock && st.wasFar && st.dist < b.approachM) {
        once(`w.${b.id}.approach`, () => {
          say(L.approach, { priority: 'low' });
          if (L.mcApproach) mcReact(L.mcApproach);
          if (L.approachCmdr) after(3, () => say(L.approachCmdr));
        });
      }
      if (st.holding && st.wasFar) {
        once(`w.${b.id}.arrive`, () => {
          say(L.arrive);
          unlockCodex(b);
          if (L.mc) mcReact(L.mc);
          if (L.echo) say(L.echo, { delay: 6 });
          if (L.rings) after(14, () => say(L.rings));
        });
      }
    }
    if (ship.lock && ship.lock.kind === 'docked') { const b = byId[ship.lock.body]; if (b) once(`w.${b.id}.dockedunlock`, () => unlockCodex(b)); }
  }

  if (ctx.bus && ctx.bus.on) {
    ctx.bus.on('interact', (e) => { if (e && e.id === 'eur.log.5') discover('elysium'); });
    ctx.bus.on('scenario', resetRun);
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  // 6. public API
  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  const targets = {};
  function target(id) {
    const b = byId[id];
    if (!b) return null;
    if (targets[id]) return targets[id];
    return (targets[id] = {
      id, name: b.name, kind: 'body', sheet: b.sheet, beta: 0.9, bmin: 0, amax: 2,
      cap: b.cap, standoff: b.dockable ? 0 : b.standoff, radius: b.radius, fall: false,
      get pos() { return goalPos(b, ship.S[0]); },
      get center() { return posAt(b, ship.S[0]); },
      refU(X, out) { return bodyU(b, X[0], X, out); },
    });
  }

  function bodyState(id, t) {
    const b = byId[id];
    if (!b) return null;
    t = t === undefined ? ship.S[0] : t;
    return { id, pos: posAt(b, t), vel: velAt(b, t), sheet: b.sheet, parent: b.orbit && b.orbit.parent ? b.orbit.parent : null, radius: b.radius, radiusKm: b.radiusKm };
  }

  function dilationOf(b, t) {
    const a = K.a || 0, p = posAt(b, t);
    if (b.sheet > 0) {
      const par = b.orbit && b.orbit.parent ? posAt(byId[b.orbit.parent], t) : p, r = len(par), x = Math.pow(r, -1.5);
      return Math.sqrt(Math.max(0, 1 - 3 / r + 2 * a * x)) / (1 + a * x);
    }
    return Math.sqrt(Math.max(0, 1 - kerr.mparts(p[0], p[1], p[2], -1).f));
  }
  function reachability(b) {
    const S = ship.S, r = kerr.ksR(S[1], S[2], S[3], ship.sheet);
    if (ship.universe > 0) return [false, 'No way back — this is not our universe.'];
    if (ship.sheet < 0) return b.sheet < 0 ? [true, ''] : [false, 'No path from the negative universe — the way back is closed.'];
    if (r < K.rp) return [false, 'Inside the horizon — only inward targets remain.'];
    return b.sheet > 0 ? [true, ''] : [false, 'Beyond the ring — reachable only through it.'];
  }
  function destinations() {
    refresh();
    return BODIES.map((b) => {
      const st = ST[b.id], [ok, why] = reachability(b);
      return {
        id: b.id, name: b.name, group: b.group, kind: b.kind, reachable: ok, why,
        dist: st.dist, lag: st.present ? st.lag : st.dist, dilation: dilationOf(b, ship.S[0]),
        landable: !!b.landable, sites: b.sites.map((s) => ({ id: s.id, name: s.name, desc: s.desc })),
        discovered: isDiscovered(b.id), radiusKm: b.radiusKm,
        orbitR: b.orbit ? (b.orbit.parent ? 0 : b.orbit.r) : len(b.fixed.pos), parent: b.orbit && b.orbit.parent ? b.orbit.parent : null,
        desc: b.desc, present: st.present,
      };
    });
  }

  const COL = { station: '#7be3ff', body: '#ffb04d', anti: '#ff6cf0', target: '#ffffff' };
  function hudMarkers() {
    refresh();
    const cur = ctx.nav && ctx.nav.current ? ctx.nav.current() : null;
    const tid = typeof cur === 'string' ? cur : cur && cur.id;
    const out = [];
    for (const b of BODIES) {
      const st = ST[b.id];
      if (!st.present || !st.dirCenter || !isDiscovered(b.id)) continue;
      const kind = b.id === tid ? 'target' : b.dockable ? 'station' : 'body';
      const alt = st.dist - b.radius;
      const sub2 = !b.dockable && alt < 3 * b.radius ? `ALT ${fmtDist(alt)}` : `${fmtDist(st.dist)} · ${st.lag.toFixed(st.lag < 10 ? 1 : 0)} s`;
      out.push({ dir: st.dirCenter.slice(), label: b.label, sub: sub2, color: kind === 'target' ? COL.target : b.sheet < 0 ? COL.anti : b.dockable ? COL.station : COL.body, kind, id: b.id, dist: st.dist });
    }
    return out;
  }

  function nearest() {
    refresh();
    let best = null;
    for (const b of BODIES) {
      const st = ST[b.id];
      if (!st.present) continue;
      if (!best || st.dist < best.dist) best = { id: b.id, name: b.name, kind: b.kind, dist: st.dist, alt: st.dist - b.radius, altKm: (st.dist - b.radius) * KM_PER_M, distR: st.dist / b.radius, beta: st.betaRel, holding: st.holding, body: b };
    }
    return best;
  }

  function contextAction() {
    const lock = ship.lock;
    if (busy) return null;
    if (lock) {
      const b = byId[lock.body];
      if (!b) return null;
      if (lock.kind === 'landed') { const s = siteOf(b, lock.site); return { label: `TAKE OFF · ${b.label}${s ? ' — ' + s.name.toUpperCase() : ''}`, kind: 'takeoff', body: b.id, run: () => doTakeoff() }; }
      if (lock.kind === 'docked') return { label: `UNDOCK · ${b.name.toUpperCase()}`, kind: 'undock', body: b.id, run: () => doUndock() };
      return null;
    }
    refresh();
    const b = heldBody();
    if (!b) return null;
    if (b.dockable) return { label: `DOCK · ${b.name.toUpperCase()}`, kind: 'dock', body: b.id, run: () => doDock(b) };
    if (b.landable && b.sites.length) {
      const s = currentSite(b);
      return { label: `LAND · ${b.label} — ${s.name.toUpperCase()}`, kind: 'land', body: b.id, site: s.id, sites: b.sites.length, run: () => doLand(b) };
    }
    return null;
  }
  function cycleSite() {
    const b = heldBody();
    if (!b || b.sites.length < 2) return null;
    siteIdx[b.id] = ((siteIdx[b.id] || 0) + 1) % b.sites.length;
    return currentSite(b);
  }
  function selectSite(bodyId, siteId) {
    const b = byId[bodyId], i = b ? b.sites.findIndex((s) => s.id === siteId) : -1;
    if (i < 0) return false;
    siteIdx[bodyId] = i;
    return true;
  }

  function scan() {
    refresh();
    for (const b of BODIES) {
      const st = ST[b.id];
      if (!st.present || !b.lines.scan || ship.lock || st.dist > 30 * b.radius) continue;
      if (scanCool > 0) return false;
      scanCool = 20;
      say(b.lines.scan);
      emit('scan', { body: b.id });
      unlockCodex(b);
      return true;
    }
    return false;
  }

  // directions of the light source / parent planet as seen from a landed site, in landed ship space (east, up, −north)
  function skyAt(bodyId, siteId, t) {
    const b = byId[bodyId], site = b && siteOf(b, siteId);
    if (!b || !site) return null;
    t = t === undefined ? ship.S[0] : t;
    const ax = axesAt(b, t), sc = siteCoefs(site), n = comb(ax, sc.n), east = comb(ax, sc.east), north = comb(ax, sc.north);
    const toShipSpace = (w) => { const u = unit(w); return [dot(u, east), dot(u, n), -dot(u, north)]; };
    const p = posAt(b, t);
    const light = b.sheet > 0 ? mul(p, -1) : LIGHT.galaxyDir, dSun = b.sheet > 0 ? len(p) : 1e9;
    const out = {
      erebus: toShipSpace(light),
      erebusAngRadiusDeg: b.sheet > 0 ? Math.atan(LIGHT.srcRadiusM / dSun) / DEG : LIGHT.galaxyAngRadius / DEG,
      shadowAngRadiusDeg: b.sheet > 0 ? Math.atan(5.2 / dSun) / DEG : 0,
      parent: null, galaxy: b.sheet < 0 ? toShipSpace(LIGHT.galaxyDir) : null, galaxy2: b.sheet < 0 ? toShipSpace(LIGHT.galaxy2Dir) : null,
    };
    if (b.frame.type === 'locked' && b.frame.to !== 'erebus') {
      const par = byId[b.frame.to], pp = posAt(par, t), d = sub(pp, p);
      out.parent = { id: par.id, dir: toShipSpace(d), angRadiusDeg: Math.asin(clamp(par.radius / len(d), 0, 1)) / DEG, phaseCos: dot(unit(mul(d, -1)), unit(mul(pp, -1))) };
    }
    // landed here right now → report what the ship's tetrad sees (relativistically aberrated, as the ray tracer draws it)
    const lk = ship.lock;
    if (lk && lk.kind === 'landed' && lk.body === bodyId && Math.abs(t - ship.S[0]) < 1e-6) {
      const S = ship.S, ss = (n) => [n[0], n[1], -n[2]];
      out.erebus = ss(kerr.apparentBody(b.sheet > 0 ? [-S[1], -S[2], -S[3]] : mul(LIGHT.galaxyDir, 1e5)));
      if (b.sheet < 0) { out.galaxy = out.erebus.slice(); out.galaxy2 = ss(kerr.apparentBody(mul(LIGHT.galaxy2Dir, 1e5))); }
      if (out.parent) out.parent.dir = ss(kerr.apparentBody(sub(posAt(byId[b.frame.to], t), [S[1], S[2], S[3]])));
      out.apparent = true;
    }
    return out;
  }

  function update(dt) {
    wall += dt;
    for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const tm = timers.splice(i, 1)[0]; try { tm.fn(); } catch (e) { console.warn(e); } } }
    scanCool = Math.max(0, scanCool - dt);
    if (ship.sheet < 0) loadModel('eurydice');
    refresh(true);
    updateLockProgress(dt);
    triggers(dt);
    for (const id of ['halcyon', 'eurydice']) { const m = mesh[id]; if (m && m.update) m.update(dt, ship.S[0]); }
  }

  // swept test against the previous call so 0.9c cruise cannot tunnel through a world
  const lastPos = new Float64Array(4);
  function collide(S, sheet) {
    const t = S[0];
    let hit = false;
    const px = lastPos[0] === sheet ? lastPos[1] : S[1], py = lastPos[0] === sheet ? lastPos[2] : S[2], pz = lastPos[0] === sheet ? lastPos[3] : S[3];
    for (const b of BODIES) {
      if (b.sheet !== sheet || b.dockable) continue;
      const c = posAt(b, t), R = b.radius + 2 / KM_PER_M;
      const seg = [S[1] - px, S[2] - py, S[3] - pz], sl = len(seg);
      let rel = [S[1] - c[0], S[2] - c[1], S[3] - c[2]];
      let d = len(rel);
      if (sl > 1e-9 && sl < 20) {                           // closest point on the segment to the centre
        const s = clamp(dot(sub(c, [px, py, pz]), seg) / (sl * sl), 0, 1);
        const q = [px + seg[0] * s - c[0], py + seg[1] * s - c[1], pz + seg[2] * s - c[2]];
        if (len(q) < R && d >= R) { rel = q; d = len(q); }
      }
      if (d < R) {
        const n = d > 1e-12 ? mul(rel, 1 / d) : [0, 0, 1];
        S[1] = c[0] + n[0] * R; S[2] = c[1] + n[1] * R; S[3] = c[2] + n[2] * R;
        bodyU(b, t, [t, S[1], S[2], S[3]], _Ub);
        for (let m = 0; m < 4; m++) S[4 + m] = _Ub[m];
        kerr.orthonormalize(S, sheet);
        hit = true;
      }
    }
    lastPos[0] = sheet; lastPos[1] = S[1]; lastPos[2] = S[2]; lastPos[3] = S[3];
    return hit;
  }

  // ── other agents' exterior models are lazy-loaded; placeholders until they arrive ───────────────────────────────
  function placeholderHalcyon() {
    const g = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.55, metalness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.7, metalness: 0.4 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(620, 38, 14, 96), hull); ring.rotation.x = Math.PI / 2; g.add(ring);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 180, 24), hull));
    for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 600, 6), dark); sp.rotation.z = Math.PI / 2; sp.rotation.y = (i / 6) * Math.PI; g.add(sp); }
    return g;
  }
  function placeholderEurydice() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(4.5, 36, 6, 18), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.6, metalness: 0.4 }));
    body.rotation.x = Math.PI / 2; body.position.z = 14; g.add(body);
    return g;
  }
  setMesh('halcyon', placeholderHalcyon(), null, null, true);
  setMesh('eurydice', placeholderEurydice(), null, null, true);
  // real exterior models: Halcyon loads at creation (visible from the first frame), EURYDICE the first time the ship is on the
  // negative sheet. loadModels() returns a promise for both (loading screens / tests). Failures keep the placeholder.
  const loading = {};
  function loadModel(id) {
    if (opts.noModels) return Promise.resolve();
    if (loading[id]) return loading[id];
    return (loading[id] = (async () => {
      try {
        if (id === 'halcyon') {
          const m = await import('./halcyon.js');
          if (m.buildHalcyonExterior) {
            const g = m.buildHalcyonExterior(THREE), ud = (g && g.userData) || {};
            setMesh('halcyon', g, ud.dock || null, typeof ud.update === 'function' ? ud.update : null);
          }
        } else {
          const m = await import('../ship/model.js');
          const build = m.buildShipAsync || m.buildShip;
          if (build) {
            const model = await build(ctx, { variant: 'eurydice' }), dk = model && model.airlock && model.airlock.dock;
            setMesh('eurydice', model.group, dk ? { pos: dk.pos, normal: dk.normal, up: [0, 1, 0] } : null, typeof model.update === 'function' ? model.update : null);
          }
        }
      } catch (e) { console.warn(`[worlds] ${id} model unavailable — using placeholder`, e); }
    })());
  }
  loadModel('halcyon');

  return {
    catalog, update, renderFar, hudMarkers, destinations, target, contextAction, lockState, bodyState, nearest, collide, scan,
    cycleSite, selectSite, skyAt, discover, reset: resetRun,
    loadModels: () => Promise.all([loadModel('halcyon'), loadModel('eurydice')]),
    setQuality: (q) => { quality = q === 'fast' ? 'fast' : 'full'; },
    get busy() { return busy; },
    debug: { refresh, state: ST, mesh, posAt, velAt, axesAt, axesOrtho4, goalPos, setMesh, gl, plasma: (v) => { plasmaAmt = v; }, lightFor },
  };
}
