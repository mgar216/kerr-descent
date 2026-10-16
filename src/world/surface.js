// ORPHEUS · planet surfaces — orchestrator.
//   const surface = createSurface(ctx);   // ctx.surface = surface (core wires it)
//   await surface.enter('asphodel', 'meadow');   // builds the scene in ship space, plays the ~5 s landing, resolves after touchdown
//   surface.update(dt);                          // every frame while active (also during enter/exit animations)
//   await surface.exit();                        // ~4 s take-off animation, disposes the scene
//   surface.reset();                             // immediate dispose, no animation (title / restart)
//   surface.active · surface.space (WalkSpace) · surface.siteInfo
//
// Frame: SHIP SPACE (m). Origin = pilot eye of the landed ship, −Z = ship forward = local north, ground under the ship at
// `ctx.shipModel?.landing.groundY ?? -4.6`. Everything lives in `ctx.scenes.near`.
//
// Light direction (toward Erebus, ship space), first match wins:
//   ctx.surfaceSunOverride (array or null; dev harness) → ctx.worlds.skyAt(bodyId, siteId, t).erebus → ctx.obs.bhApp ([r,u,f] → [r,u,−f]) → site default.
//   Elysium ignores Erebus and uses a fixed pale-blue galaxy light.
// The core's own env key light must be disabled while `surface.active` (this module's DirectionalLight lights the landed ship too).
// While active this module raises `cameras.near.far` (≥ 3e5) and lowers `.near` (≤ 0.05); both are restored on exit/reset.
import * as THREE from 'three';
import { BODY_FALLBACK, LOOKS, getSiteDef, dirFromAzEl, DEG } from './terrain/sites.js';
import { Heightfield, makeFeatures } from './terrain/biomes.js';
import { Atmosphere } from './terrain/atmosphere.js';
import { createTerrain } from './terrain/terrain.js';
import { createPoiEnv, disposeTree } from './terrain/poi_common.js';

const G0 = 9.81;
const LAND_FROM = -380, LAND_T = 5.0, TAKEOFF_TO = -600, TAKEOFF_T = 4.0;
// ORPHEUS landing legs when the ship model does not publish `landing.legs` (hinge on the hull → foot pad on the ground; mirrors src/ship/parts/layout.js LEGS)
const LEGS_DEFAULT = (G) => [
  { hinge: [-3.7, -1.35, 4.6], foot: [-5.2, G, 4.2] }, { hinge: [3.7, -1.35, 4.6], foot: [5.2, G, 4.2] },
  { hinge: [-3.4, -1.35, 33.5], foot: [-5.0, G, 33.9] }, { hinge: [3.4, -1.35, 33.5], foot: [5.0, G, 33.9] },
];
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

let _catalogP = null;
function loadCatalog() { return (_catalogP ||= import('./catalog.js').then((m) => m.byId || m.default?.byId || null).catch(() => null)); }
async function tryImport(path) { try { return await import(path); } catch (e) { console.warn(`[surface] optional module ${path} unavailable:`, e?.message || e); return null; } }

export function createSurface(ctx) {
  let S = null;                       // current session
  let enterSeq = 0;                   // cancels in-flight enters (reset / newer enter)
  const api = {
    get active() { return !!S; },
    get space() { return S ? S.space : null; },
    get siteInfo() { return S ? S.info : null; },
    enter, exit, reset, update,
    /** dev/debug handle */
    get _state() { return S; },
    /** 0..1: the player is inside the ship — dims the hemisphere fill (so it does not wash the interior) and muffles the ambience. Smoothed. */
    setIndoors(v) { if (S) S.indoorsTarget = clamp(v, 0, 1); },
    /** re-bake the sky reflection used by props (call after the light moved a lot) */
    refreshEnv() { if (S) bakeEnv(S); },
  };

  // ───────────────────────────── enter ─────────────────────────────
  async function enter(bodyId, siteId, opts = {}) {
    if (S) reset();
    const my = ++enterSeq;
    const t0 = performance.now();
    const cat = await loadCatalog();
    if (my !== enterSeq) return null;
    const def = getSiteDef(bodyId, siteId);
    siteId = def.id;
    const biome = def.biome;
    const fb = BODY_FALLBACK[bodyId];
    const cb = cat?.[bodyId] || {};
    const body = {
      id: bodyId, name: cb.name || fb.name,
      radiusM: (cb.radiusKm || fb.radiusKm) * 1000, g: cb.g ?? fb.g,
      atmosphere: cb.atmosphere !== undefined ? cb.atmosphere : fb.atmosphere,
    };
    if (biome === 'elysium' && !body.atmosphere) body.atmosphere = fb.atmosphere;
    const look = { ...LOOKS[biome], ...(def.lookOverride || {}) };
    const shipModel = ctx.shipModel || null;
    const groundY0 = shipModel?.landing?.groundY ?? -4.6;
    const bnds = shipModel?.hull?.bounds;
    const padCenter = bnds ? [(bnds.min.x + bnds.max.x) / 2, (bnds.min.z + bnds.max.z) / 2] : [0, 18];
    const padHalf = bnds ? Math.max((bnds.max.x - bnds.min.x) / 2, (bnds.max.z - bnds.min.z) / 2) : 28;
    const padR0 = padHalf + 5, padR1 = padR0 + 26;

    const near = ctx.scenes.near, cam = ctx.cameras.near;
    S = {
      bodyId, siteId, biome, def, body, look, groundY0, padCenter, padR0, padR1, t: 0, phase: 'build',
      world: new THREE.Group(), lights: [], disposers: [], pois: [], interactables: [], colliders: [], extraColliders: [],
      sunDir: new THREE.Vector3(0, 1, 0), sunTarget: new THREE.Vector3(0, 1, 0), sunInit: false,
      cam, near, savedCam: { near: cam.near, far: cam.far }, anim: null, resolveEnter: null, resolveExit: null, exiting: false,
      shadowTimer: 0, shadowCenter: new THREE.Vector3(), lastShadowDir: new THREE.Vector3(), lastShadowCenter: new THREE.Vector3(1e9, 0, 0),
      buildMs: {}, rampFoot: null, rampTop: null, rampW: 1.2, seaLevelY: null, flora: null, water: null, fx: null, amb: null, poiRes: null, env: null,
      state: { wind: 0, geyser: 0, lava: 0, crystal: 0, shore: 0, speed: 0, indoors: 0, sunUp: 1 },
      lastCam: new THREE.Vector3(), camInit: false,
    };
    S.world.name = `surface:${bodyId}/${siteId}`;
    cam.near = Math.min(cam.near, 0.05); cam.far = Math.max(cam.far, 3e5); cam.updateProjectionMatrix();

    // heightfield / terrain / atmosphere
    let tt = performance.now();
    S.hf = new Heightfield(biome, def, { groundY0, radiusM: body.radiusM, padCenter, padR0, padR1 });
    S.features = makeFeatures(biome, def, S.hf);
    S.atmo = new Atmosphere(biome, body, look);
    if (biome === 'asphodel' && def.terrain.seaOn) { S.seaRel = -S.hf.h0; S.seaLevelY = groundY0 + S.seaRel; }
    S.terrain = createTerrain({ renderer: ctx.renderer, hf: S.hf, atmo: S.atmo, biome, groundY0, seaY: S.seaRel ?? -1e5 });
    S.world.add(S.terrain.group);
    S.buildMs.terrain = performance.now() - tt;

    // sun / lights (initial direction before first frame)
    readSun(S, 0, true);
    S.atmo.setSun([S.sunDir.x, S.sunDir.y, S.sunDir.z]);
    buildLights(S);

    // sky dome (not part of the offset world — the sky must not fall with the terrain)
    S.dome = S.atmo.createDome();
    if (S.dome) near.add(S.dome);

    // prop reflection map
    tt = performance.now();
    bakeEnv(S);
    S.buildMs.env = performance.now() - tt;

    // ramp (ship) geometry from the ship model
    const land = shipModel?.landing;
    S.rampFoot = land?.rampFoot ? new THREE.Vector3(...land.rampFoot) : new THREE.Vector3(0, groundY0, 34);
    S.rampTop = land?.rampTop ? new THREE.Vector3(...land.rampTop) : new THREE.Vector3(0, groundY0 + 3.4, 27);
    S.rampW = land?.rampWidth ? land.rampWidth / 2 : 1.25;
    S.rampFoot.y = Math.max(S.rampFoot.y, S.hf.groundY(S.rampFoot.x, S.rampFoot.z));

    // water, flora, POIs, fx, ambience (each optional/guarded)
    tt = performance.now();
    const sess0 = S;
    await buildOptional(S);
    if (S !== sess0) { try { sess0.amb?.dispose?.(); sess0.fx?.dispose?.(); sess0.flora?.dispose?.(); sess0.water?.dispose?.(); disposeTree(sess0.world); } catch { /* aborted enter */ } return null; }
    S.buildMs.optional = performance.now() - tt;

    // walk space
    buildSpace(S);
    S.info = buildInfo(S);

    near.add(S.world);
    shipModel?.setLanded?.(true);

    // pre-compile every program (hides shader-compile hitches behind the fade); bake the height clipmap for the landing camera
    tt = performance.now();
    S.world.position.y = LAND_FROM;
    const sess = S;
    try { await S.terrain.compileBake(); } catch (e) { console.warn('[surface] bake compile', e); }
    if (S !== sess) return null;
    cam.getWorldPosition(_cp); const bakeCamPos = { x: _cp.x, z: _cp.z };
    S.terrain.bakeAll(bakeCamPos);
    try { await S.flora?.compile?.(); } catch (e) { console.warn('[surface] flora compile', e); }
    if (S !== sess) return null;
    S.flora?.bakeAll?.(bakeCamPos);
    try { await (ctx.renderer.compileAsync ? ctx.renderer.compileAsync(near, cam) : (ctx.renderer.compile(near, cam), null)); } catch (e) { console.warn('[surface] compile', e); }
    if (S !== sess) return null;
    // one throw-away render into a tiny target: compiles the shadow-depth programs + uploads textures so the first visible frame does not hitch
    try {
      const R = ctx.renderer, wrt = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType }), pRT = R.getRenderTarget(), pAuto = R.autoClear;
      R.setRenderTarget(wrt); R.autoClear = true; R.render(near, cam); R.setRenderTarget(pRT); R.autoClear = pAuto; wrt.dispose();
    } catch (e) { console.warn('[surface] warm render', e); }
    if (S !== sess) return null;
    S.buildMs.compile = performance.now() - tt;
    S.buildMs.total = performance.now() - t0;
    S.info.buildMs = S.buildMs;

    S.onInteract = (p) => { const e = S?.env; if (e && p) { e.interactSeen.id = p.id; e.interactSeen.t = performance.now(); } };
    ctx.bus?.on?.('interact', S.onInteract);
    S.amb?.start?.();

    if (opts.instant) { S.world.position.y = 0; S.phase = 'landed'; touchdown(S, true); return S.info; }
    S.phase = 'landing'; S.anim = { t: 0 };
    try { opts.onReady?.(S.info); } catch (e) { console.warn('[surface] onReady', e); } // caller lifts its fade here: the descent is meant to be seen
    return new Promise((res) => { S.resolveEnter = () => res(S ? S.info : null); });
  }

  // ───────────────────────────── exit / reset ─────────────────────────────
  function exit() {
    if (!S) return Promise.resolve();
    if (S.phase === 'build') { reset(); return Promise.resolve(); }
    if (S.exiting) return new Promise((res) => { const prev = S.resolveExit; S.resolveExit = () => { prev?.(); res(); }; });
    const s = S;
    s.exiting = true;
    if (s.phase === 'landing') { s.resolveEnter?.(); s.resolveEnter = null; }
    ctx.shipModel?.setLanded?.(false);
    s.phase = 'takeoff'; s.anim = { t: 0 };
    const mid = s.padCenter;
    s.fx?.burst?.('liftoff', mid[0], mid[1], 1);
    try { ctx.audio?.ready && ctx.audio.whoosh?.(2.2); } catch { /* optional */ }
    return new Promise((res) => { s.resolveExit = () => res(); });
  }

  function reset() {
    enterSeq++;
    if (!S) return;
    const s = S;
    ctx.shipModel?.setLanded?.(false);
    disposeSession(s);
    S = null;
    s.resolveEnter?.(); s.resolveExit?.();
  }

  function disposeSession(s) {
    try { if (s.onInteract) ctx.bus?.off?.('interact', s.onInteract); } catch { /* optional */ }
    try { s.amb?.dispose?.(); } catch (e) { console.warn(e); }
    try { s.fx?.dispose?.(); } catch (e) { console.warn(e); }
    try { s.flora?.dispose?.(); } catch (e) { console.warn(e); }
    try { s.water?.dispose?.(); } catch (e) { console.warn(e); }
    try { s.poiRes?.dispose?.(); } catch (e) { console.warn(e); }
    s.terrain?.dispose?.();
    for (const l of s.lights) { l.parent?.remove(l); l.shadow?.map?.dispose?.(); l.dispose?.(); }
    if (s.sun) s.near.remove(s.sun.target);
    if (s.fill) s.near.remove(s.fill.target);
    s.near.remove(s.world); disposeTree(s.world);
    if (s.dome) { s.near.remove(s.dome); s.dome.traverse((o) => { o.material?.dispose?.(); }); s.dome.children[0]?.geometry?.dispose?.(); }
    s.envRT?.dispose?.(); s.envPM?.dispose?.();
    s.cam.near = s.savedCam.near; s.cam.far = s.savedCam.far; s.cam.updateProjectionMatrix();
  }

  // ───────────────────────────── light / env ─────────────────────────────
  function buildLights(s) {
    const L = s.look;
    const sun = s.sun = new THREE.DirectionalLight(0xffffff, L.sunI);
    sun.name = 'surface-sun'; sun.castShadow = true;
    const size = (ctx.renderer.capabilities.maxTextureSize >= 4096) ? 3072 : 2048;
    sun.shadow.mapSize.set(size, size);
    const sc = sun.shadow.camera; sc.left = -96; sc.right = 96; sc.top = 96; sc.bottom = -96; sc.near = 20; sc.far = 800;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; sun.shadow.radius = 2;
    sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true;
    s.near.add(sun, sun.target);
    const hemi = s.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    hemi.name = 'surface-hemi'; s.near.add(hemi);
    s.lights.push(sun, hemi);
    if (s.biome === 'charon') {   // Lethe-shine: a big soft blue-violet fill from the parent planet
      const fill = s.fill = new THREE.DirectionalLight(new THREE.Color(0.55, 0.6, 1.0), 0.55);
      fill.name = 'surface-lethe'; fill.position.set(0, 1, 0); s.near.add(fill, fill.target); s.lights.push(fill);
      s.fillDir = new THREE.Vector3(-0.45, 0.62, -0.64).normalize();
    }
    if (s.biome === 'phlegethon' || s.biome === 'elysium') {   // local glow lights (lava / crystals) — intensity driven per frame, count constant
      const g = s.glow = new THREE.PointLight(s.biome === 'phlegethon' ? 0xff6a22 : 0x66ccff, 0, 60, 2);
      g.name = 'surface-glow'; g.castShadow = false; s.near.add(g); s.lights.push(g);
    }
    applyLights(s, true);
  }

  function applyLights(s, force) {
    const a = s.atmo;
    s.sun.color.copy(a.sunColor); s.sun.intensity = a.sunIntensity;
    s.hemi.color.copy(a.hemiSky); s.hemi.groundColor.copy(a.hemiGround); s.hemi.intensity = a.hemiIntensity * (1 - 0.85 * (s.indoors || 0));
  }

  function bakeEnv(s) {
    // small sky+ground cube → PMREM, used as envMap by props (kit.std). Cheap; regenerated on demand only.
    try {
      s.envRT?.dispose?.();
      const pm = s.envPM || (s.envPM = new THREE.PMREMGenerator(ctx.renderer));
      const sc = new THREE.Scene();
      const dome = s.atmo.createDome();
      if (dome) sc.add(dome);
      const gcol = s.atmo.hemiGround.clone().multiplyScalar(0.9 + 0.1);
      const ground = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: gcol, side: THREE.BackSide, toneMapped: false, fog: false }));
      sc.add(ground);
      s.envRT = pm.fromScene(sc, 0.02, 0.1, 10);
      s.envMap = s.envRT.texture;
      sc.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      if (s.env) { s.env.envMap = s.envMap; for (const m of (s.env.materials || [])) { m.envMap = s.envMap; m.needsUpdate = true; } }
    } catch (e) { console.warn('[surface] env bake failed', e); s.envMap = null; }
  }

  // ───────────────────────────── optional modules ─────────────────────────────
  async function buildOptional(s) {
    const { biome, bodyId, siteId, def } = s;
    // POIs
    const pm = await tryImport(`./terrain/poi_${biome}.js`);
    const env = s.env = createPoiEnv({
      ctx, bodyId, siteId, site: def, body: s.body, groundY: (x, z) => s.hf.groundY(x, z), groundNormal: (x, z, o) => s.hf.groundNormal(x, z, o || new THREE.Vector3()),
      seaLevelY: s.seaLevelY, features: s.features, sunDir: s.sunDir, fog: (m) => s.atmo.patchMaterial(m), envMap: s.envMap,
      shipPad: { x: s.padCenter[0], z: s.padCenter[1], r: s.padR0 }, palette: {},
    });
    env.materials = env.materials || [];
    if (pm?.buildPois) {
      try {
        const t0 = performance.now();
        s.poiRes = pm.buildPois(env);
        s.buildMs.pois = performance.now() - t0;
        if (s.poiRes?.group) s.world.add(s.poiRes.group);
        for (const it of s.poiRes?.interactables || []) s.interactables.push(it);
        for (const c of s.poiRes?.colliders || []) s.colliders.push(c);
        if (s.poiRes?.group) s.poiRes.group.traverse((o) => { if (o.isLight) s.poiLights = (s.poiLights || 0) + 1; });
      } catch (e) { console.error('[surface] POI build failed', e); }
    }
    // water
    if (s.seaLevelY !== null) {
      const wm = await tryImport('./terrain/water.js');
      if (wm?.createWater) { try { s.water = wm.createWater({ hf: s.hf, atmo: s.atmo, biome, groundY0: s.groundY0, seaRel: s.seaRel, terrainShared: s.terrain.shared }); s.world.add(s.water.group); } catch (e) { console.error('[surface] water failed', e); } }
    }
    // flora (asphodel grass here; other biomes via flora_scatter.js)
    const fm = await tryImport('./terrain/flora.js');
    const sm = biome === 'asphodel' ? null : await tryImport('./terrain/flora_scatter.js');
    if (fm?.createFlora) {
      try {
        s.flora = fm.createFlora({ THREE, ctx, hf: s.hf, atmo: s.atmo, biome, site: def, groundY0: s.groundY0, seaRel: s.seaRel, terrainShared: s.terrain.shared, padCenter: s.padCenter, padR0: s.padR0, camera: s.cam, features: s.features, env, scatterFactory: sm?.createScatterFlora || null });
        s.world.add(s.flora.group); for (const c of s.flora.colliders || []) s.extraColliders.push(c);
      } catch (e) { console.error('[surface] flora failed', e); }
    }
    // fx
    const xm = await tryImport('./terrain/fx.js');
    if (xm?.createSurfaceFx) {
      try { s.fx = xm.createSurfaceFx({ THREE, ctx, biome, siteId, site: def, groundY: (x, z) => s.hf.groundY(x, z), camera: s.cam, sunDir: s.sunDir, palette: {}, features: s.features, shipPad: env.shipPad }); s.world.add(s.fx.group); } catch (e) { console.error('[surface] fx failed', e); }
    }
    // ambience
    const am = await tryImport('./terrain/ambience.js');
    if (am?.createAmbience) { try { s.amb = am.createAmbience(ctx, { bodyId, siteId, biome }); } catch (e) { console.error('[surface] ambience failed', e); } }
  }

  // ───────────────────────────── walk space ─────────────────────────────
  function buildSpace(s) {
    const { hf, rampFoot, rampTop } = s;
    const gravity = s.body.g * G0;
    const rdx = rampTop.x - rampFoot.x, rdz = rampTop.z - rampFoot.z, rlen = Math.hypot(rdx, rdz) || 1, ux = rdx / rlen, uz = rdz / rlen;
    const ramp = (x, z) => { // → { s, w } position along / lateral to the ramp strip
      const px = x - rampFoot.x, pz = z - rampFoot.z; return { s: (px * ux + pz * uz) / rlen, w: Math.abs(px * -uz + pz * ux) };
    };
    s.ramp = ramp;
    const hullBoxes = () => ctx.shipModel?.hull?.colliders || [];
    const seaY = s.seaLevelY;
    const tmpN = new THREE.Vector3();
    const footstep = (pos) => {
      switch (s.biome) {
        case 'asphodel': return 'sand';
        case 'phlegethon': return 'rock';
        case 'charon': return 'rock';
        case 'cocytus': { const l = s.features.lake; const inLake = l ? l.inside(pos.x, pos.z) > 0 : false; return inLake ? 'ice' : 'snow'; }
        case 'elysium': return 'crystal';
        default: return 'rock';
      }
    };
    const board = {
      id: 'surface.board', label: 'Board ORPHEUS', pos: rampTop.clone().add(new THREE.Vector3(0, 1.0, 0)), radius: 2.0,
      use() { ctx.spaces?.enter?.('orpheus', 'ramp'); },
    };
    s.interactables.push(board);
    // landing legs (strut + foot pad) as cylinders so the player can't walk through them; legs come from the ship model when it publishes them
    {
      const G = s.groundY0, legs = ctx.shipModel?.landing?.legs || LEGS_DEFAULT(G);
      for (const lg of legs) {
        const f = lg.foot, h = lg.hinge;
        s.extraColliders.push({ x: f[0], z: f[2], r: 0.9, y0: G - 0.2, y1: G + 0.4 });
        for (const t of [0.3, 0.55, 0.8]) {
          const x = h[0] + (f[0] - h[0]) * t, y = h[1] + (f[1] - h[1]) * t, z = h[2] + (f[2] - h[2]) * t;
          s.extraColliders.push({ x, z, r: 0.3, y0: y - 0.6, y1: y + 0.6 });
        }
      }
    }
    const sx = rampFoot.x - ux * 1.3, sz = rampFoot.z - uz * 1.3;
    const first = Object.values(s.def.slots)[0];   // spawn facing the site's primary point of interest (three.js yaw: 0 = −Z, + = left)
    const spawnYaw = first ? Math.atan2(-(first.x - sx), -(first.z - sz)) : Math.atan2(ux, uz);
    s.space = {
      id: 'surface', name: `${s.body.name} — ${s.def.name}`, gravity,
      spawn: { pos: [sx, hf.groundY(sx, sz), sz], yaw: spawnYaw },
      interactables: s.interactables,
      footstep,
      floorAt(x, z, yFeet) {
        const r = ramp(x, z);
        if (r.s >= -0.02 && r.s <= 1.02 && r.w < s.rampW) {
          const ry = rampFoot.y + clamp(r.s, 0, 1) * (rampTop.y - rampFoot.y);
          if (ry - yFeet <= 0.46) return ry;
        }
        const gy = hf.groundY(x, z);
        if (seaY !== null && seaY - gy > 1.3) return null;           // too deep to wade
        if (gy - yFeet > 0.46) return null;                           // step too high
        if (gy - yFeet > 0.12) { hf.groundNormal(x, z, tmpN); if (tmpN.y < 0.62) return null; }   // too steep to climb
        return gy;
      },
      collide(p, radius, height) {
        const y0 = p.y, y1 = p.y + height;
        const push = (min, max) => {
          const cx = clamp(p.x, min[0], max[0]), cz = clamp(p.z, min[2], max[2]);
          let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
          if (d2 >= radius * radius) return;
          if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (radius - d) / d; p.x += dx * k; p.z += dz * k; return; }
          // centre inside the box: exit through the nearest face
          const l = p.x - min[0], r = max[0] - p.x, b = p.z - min[2], f = max[2] - p.z, m = Math.min(l, r, b, f);
          if (m === l) p.x = min[0] - radius; else if (m === r) p.x = max[0] + radius; else if (m === b) p.z = min[2] - radius; else p.z = max[2] + radius;
        };
        const pushCyl = (c) => {
          const dx = p.x - c.x, dz = p.z - c.z, rr = radius + c.r, d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr) return;
          const d = Math.sqrt(d2) || 1e-4; const k = rr / d; p.x = c.x + dx * k; p.z = c.z + dz * k;
        };
        const hit = (c) => {
          if (c.min) { if (y1 > c.min[1] + 0.05 && y0 < c.max[1] - 0.05) push(c.min, c.max); }
          else if (y1 > c.y0 + 0.05 && y0 < c.y1 - 0.05) pushCyl(c);
        };
        for (const c of s.colliders) hit(c);
        for (const c of s.extraColliders) hit(c);
        s.flora?.collide?.(p, radius, height);
        const rr = ramp(p.x, p.z);
        if (!(rr.s > -0.35 && rr.s < 1.25 && rr.w < s.rampW + 0.5)) for (const b of hullBoxes()) hit(b);
        else if (rr.w >= s.rampW - 0.05 && rr.w < s.rampW + 0.5 && rr.s > 0.0) { /* ramp rails keep the player on the strip */ }
      },
      update(dt) { /* nothing per-frame; scene updates run from surface.update */ },
    };
  }

  function buildInfo(s) {
    const pois = [];
    for (const it of s.interactables) if (it.id !== 'surface.board') pois.push({ id: it.id, label: typeof it.label === 'function' ? it.label() : it.label, x: it.pos.x, z: it.pos.z });
    return {
      bodyId: s.bodyId, siteId: s.siteId, bodyName: s.body.name, name: s.def.name, biome: s.biome, g: s.body.g, radiusM: s.body.radiusM,
      groundY: s.groundY0, seaLevelY: s.seaLevelY, atmosphere: !s.atmo.airless, pois, slots: s.def.slots, sunDir: s.sunDir,
      spawn: s.space.spawn, rampFoot: s.rampFoot, rampTop: s.rampTop, features: s.features, buildMs: s.buildMs,
    };
  }

  // ───────────────────────────── per-frame ─────────────────────────────
  function readSun(s, dt, snap) {
    const o = ctx.surfaceSunOverride, look = s.def.look, tgt = s.sunTarget;
    let ok = false;
    if (s.biome === 'elysium') { const a = dirFromAzEl(o?.az ?? look.az, o?.el ?? look.elev); tgt.set(a[0], a[1], a[2]); ok = true; }
    else if (Array.isArray(o)) { tgt.set(o[0], o[1], o[2]); ok = true; }
    else {
      try {
        const sky = ctx.worlds?.skyAt?.(s.bodyId, s.siteId, ctx.ship?.S?.[0]);
        if (sky?.erebus) { tgt.set(sky.erebus[0], sky.erebus[1], sky.erebus[2]); ok = true; }
        if (sky?.parent?.dir && s.fillDir) s.fillDir.set(sky.parent.dir[0], sky.parent.dir[1], sky.parent.dir[2]).normalize();
      } catch { /* worlds not ready */ }
      if (!ok && ctx.obs?.bhApp) { const b = ctx.obs.bhApp; tgt.set(b[0], b[1], -b[2]); ok = true; }
    }
    if (!ok) { const a = dirFromAzEl(look.az, look.elev); tgt.set(a[0], a[1], a[2]); }
    tgt.normalize();
    if (snap || !s.sunInit) { s.sunDir.copy(tgt); s.sunInit = true; }
    else s.sunDir.lerp(tgt, 1 - Math.exp(-dt * 5)).normalize();
  }

  const _cp = new THREE.Vector3(), _sc = new THREE.Vector3(), _tmp = new THREE.Vector3();

  function update(dt) {
    const s = S;
    if (!s) return;
    dt = Math.min(dt, 0.1);
    s.t += dt;
    const cam = s.cam;
    cam.getWorldPosition(_cp);
    _cp.y -= s.world.position.y;                // camera in terrain-local space (world group is only offset in y)

    // landing / take-off timeline
    if (s.phase === 'landing') {
      s.anim.t += dt;
      const u = clamp(s.anim.t / LAND_T, 0, 1), k = (1 - u) * (1 - u);
      s.world.position.y = LAND_FROM * k;
      const sh = ctx.fx; if (sh && u > 0.55) sh.shake = Math.max(sh.shake || 0, 0.10 + 0.25 * smooth(0.55, 1.0, u));
      if (u >= 1) { s.world.position.y = 0; s.phase = 'landed'; touchdown(s, false); }
    } else if (s.phase === 'takeoff') {
      s.anim.t += dt;
      const u = clamp(s.anim.t / TAKEOFF_T, 0, 1);
      s.world.position.y = TAKEOFF_TO * u * u;
      s.amb?.rumble?.(Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.5));
      if (u > 0.76 && !s.ambStopped) { s.ambStopped = true; try { s.amb?.stop?.(1.0); } catch { /* optional */ } }
      const sh = ctx.fx; if (sh && u < 0.5) sh.shake = Math.max(sh.shake || 0, 0.35 * (1 - u * 2));
      if (u >= 1) {
        const rs = s.resolveExit; ctx.shipModel?.setLanded?.(false);
        disposeSession(s); S = null; rs?.();
        return;
      }
    }

    // light
    s.indoors = (s.indoors || 0) + ((s.indoorsTarget || 0) - (s.indoors || 0)) * (1 - Math.exp(-dt * 3));
    readSun(s, dt, false);
    const sd = s.sunDir;
    s.atmo.setSun([sd.x, sd.y, sd.z], 1);
    applyLights(s, false);
    s.sunUp = clamp(s.atmo.sunIntensity / s.look.sunI, 0, 1);

    // shadow frustum: stays on the ship while the player is near it, follows the player when far
    const sc = s.padCenter;
    _sc.set(sc[0], s.groundY0 + 4, sc[1]);
    const dShip = Math.hypot(_cp.x - sc[0], _cp.z - sc[1]);
    const w = 1 - smooth(45, 140, dShip);
    _tmp.set(_cp.x, s.groundY0, _cp.z).lerp(_sc, w);
    const texel = 192 / s.sun.shadow.mapSize.x;
    _tmp.x = Math.round(_tmp.x / (texel * 4)) * texel * 4; _tmp.z = Math.round(_tmp.z / (texel * 4)) * texel * 4;
    s.sun.target.position.copy(_tmp);
    s.sun.position.copy(_tmp).addScaledVector(sd, 380);
    s.sun.target.updateMatrixWorld(); s.sun.updateMatrixWorld();
    s.shadowTimer -= dt;
    if (s.shadowTimer <= 0 || s.lastShadowDir.distanceToSquared(sd) > 1e-6 || s.lastShadowCenter.distanceToSquared(_tmp) > 0.01) {
      s.sun.shadow.needsUpdate = true; s.shadowTimer = 0.25; s.lastShadowDir.copy(sd); s.lastShadowCenter.copy(_tmp);
    }
    s.sun.castShadow = s.sunUp > 0.02;
    if (s.fill) { s.fill.position.copy(cam.position).addScaledVector(s.fillDir, 100); s.fill.target.position.copy(cam.position); s.fill.target.updateMatrixWorld(); s.fill.intensity = 0.55 * (0.4 + 0.6 * clamp(s.def.look.elev / 30, 0, 1)); }

    // content
    s.terrain.update(_cp, s.t);
    s.water?.update?.(_cp, s.t, sd);
    s.flora?.update?.(_cp, s.t, dt);
    s.fx?.update?.(dt, s.t, _cp);
    s.poiRes?.update?.(dt, s.t, _cp);

    // state for ambience + glow lights
    if (!s.camInit) { s.lastCam.copy(_cp); s.camInit = true; }
    const speed = dt > 0 ? _cp.distanceTo(s.lastCam) / dt : 0; s.lastCam.copy(_cp);
    const st = s.state; st.speed += (speed - st.speed) * Math.min(1, dt * 4);
    st.wind = s.def.wind ?? 0;
    st.sunUp = s.sunUp; st.indoors = s.indoors || 0;
    st.geyser = s.fx?.geyserLevel?.(_cp) ?? 0;
    st.shore = 0; st.lava = 0; st.crystal = 0;
    if (s.features.coast) st.shore = clamp(1 - Math.abs(s.features.coast.landDist(_cp.x, _cp.z)) / 140, 0, 1);
    if (s.features.river) {
      const rv = s.features.river, d = Math.abs(rv.dist(_cp.x, _cp.z));
      st.lava = clamp(1 - Math.max(d - rv.wLava, 0) / 120, 0, 1);
      if (s.glow) { // lava glow light rides along the nearest river point, slightly above the surface
        const z = _cp.z, x = rv.cx(z), y = s.hf.groundY(x, z) + 2.2 + s.world.position.y;
        s.glow.position.set(x + (clamp(_cp.x - x, -18, 18)) * 0.5, y, z); s.glow.intensity = 90 * (0.82 + 0.18 * Math.sin(s.t * 2.7) * Math.sin(s.t * 1.3 + 1)) * clamp(1.2 - d / 140, 0.1, 1);
      }
    }
    if (s.biome === 'elysium') {
      st.crystal = clamp(s.def.terrain.crystalDensity * 0.9 + 0.1, 0, 1);
      if (s.glow) { s.glow.position.set(_cp.x, s.hf.groundY(_cp.x, _cp.z) + 1.6 + s.world.position.y, _cp.z); s.glow.intensity = 14 * (0.7 + 0.3 * Math.sin(s.t * 0.7)) * st.crystal; s.glow.color.setHSL(0.55 + 0.12 * Math.sin(s.t * 0.13), 0.9, 0.62); }
    }
    s.amb?.update?.(dt, st);
  }

  function touchdown(s, silent) {
    const c = s.padCenter;
    if (!silent) {
      s.fx?.burst?.('touchdown', c[0], c[1], 1);
      try { ctx.audio?.ready && ctx.audio.boom?.(0.4); } catch { /* optional */ }
      if (ctx.fx) ctx.fx.shake = Math.max(ctx.fx.shake || 0, 0.6);
    }
    const r = s.resolveEnter; s.resolveEnter = null; r?.();
  }

  return api;
}
