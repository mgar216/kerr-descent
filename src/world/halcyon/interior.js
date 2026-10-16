// HALCYON — walkable station interior in SHIP SPACE (docked to ORPHEUS's port airlock at x ≈ −4.2, z ≈ +16).
//   const { group, space, update } = createHalcyonInterior(ctx)
// Self-lit: ≤ 6 pooled point lights chosen by proximity + emissive fixtures. While the player is inside, the core's
// env key light should be off (the interior is closed); the lounge window is a real opening onto the ray-traced sky.
// Layout (all one deck, floor y = −1.2): docking tube → concourse → operations center (stepped pit) → observation
// lounge (north, window faces ship −Z = Erebus) / science lab (south); crew-quarters corridor off the concourse.
import { getGfx } from './gfx.js';
import { makeTextures } from './textures.js';
import { createPlan, FY } from './plan.js';
import { createCrewKit, CREW } from './crew.js';
import { buildTubeAndConcourse } from './rooms_a.js';
import { buildOps } from './rooms_b.js';
import { buildLounge } from './rooms_c.js';
import { buildLab } from './rooms_d.js';

const TOPICS = {
  jonah: { who: 'Jonah Reyes · CAPCOM', topics: ['mission', 'eurydice', 'station', 'bye'] },
  fd: { who: 'Director Arthur Bell', topics: ['go', 'elena', 'bye'] },
  sci: { who: 'Dr. Ilse Varga', topics: ['hole', 'worlds', 'ghost', 'bye'] },
  mira: { who: 'Mira', topics: ['why', 'mom', 'promise', 'bye'] },
};
const FALLBACK_Q = {
  'jonah.mission': 'Walk me through the mission.', 'jonah.eurydice': 'Do you think they’re alive?', 'jonah.station': 'How’s the station these days?', 'jonah.bye': 'I should go.',
  'fd.go': 'Am I cleared to go?', 'fd.elena': 'Tell me about the day Eurydice was lost.', 'fd.bye': 'Thank you, Director.',
  'sci.hole': 'What will I find inside Erebus?', 'sci.worlds': 'What should I see out there?', 'sci.ghost': 'Tell me about the ghost on the horizon.', 'sci.bye': 'Thank you, Doctor.',
  'mira.why': 'Why do you think I have to go?', 'mira.mom': 'What do you remember about Elena?', 'mira.promise': 'I’ll find a way back to you.', 'mira.bye': 'I have to go.',
};
const NPC_LABEL = { jonah: 'Jonah Reyes — CAPCOM', fd: 'Director Arthur Bell', sci: 'Dr. Ilse Varga', mira: 'Mira' };

export function createHalcyonInterior(ctx) {
  const THREE = ctx.THREE;
  const G = getGfx(THREE);
  const T = makeTextures(G);
  const P = createPlan(THREE, G, T);
  const group = new THREE.Group();
  group.name = 'HalcyonInterior';
  const anims = [];
  const env = { THREE, G, ctx, group, anims, add: (o) => group.add(o) };
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const safe = (fn) => { try { return fn(); } catch (e) { console.warn('[halcyon]', e); } };
  const bus = (evt, payload) => safe(() => ctx.bus && ctx.bus.emit && ctx.bus.emit(evt, payload));

  // voice line text/questions (tolerate the module being absent)
  let LINES = null;
  const linesReady = import('../../voice/lines.js').then((m) => { LINES = m.LINES || null; }).catch(() => {});

  // ───────────── materials (absolute lighting; a tiny emissive floor keeps unlit corners readable) ─────────────
  const AMB = 0.03;
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x9aa2b0, emissiveIntensity: AMB, ...o });
  const mats = {
    panel: std({ map: T.panel.map, bumpMap: T.panel.bump, bumpScale: 1.4, roughness: 0.74, metalness: 0.12 }),
    soft: std({ map: T.soft, roughness: 0.96, metalness: 0 }),
    wood: std({ map: T.wood, roughness: 0.58, metalness: 0.02 }),
    deck: std({ map: T.deck.map, bumpMap: T.deck.bump, bumpScale: 1.6, roughness: 0.42, metalness: 0.4 }),
    planks: std({ map: T.planks, roughness: 0.5, metalness: 0.02 }),
    ceil: std({ map: T.ceil.map, bumpMap: T.ceil.bump, bumpScale: 1.0, roughness: 0.92, metalness: 0 }),
    solid: std({ roughness: 0.6, metalness: 0.12 }),
    metal: std({ roughness: 0.36, metalness: 0.85 }),
    fabric: std({ roughness: 0.97, metalness: 0 }),
    leaf: std({ roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
    banner: std({ map: T.banners, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92, metalness: 0, emissive: 0xffffff, emissiveMap: T.banners, emissiveIntensity: 0.14 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    screen: new THREE.MeshBasicMaterial({ map: T.screens, vertexColors: true, color: new THREE.Color(1.55, 1.55, 1.55), toneMapped: false }),
    sign: new THREE.MeshBasicMaterial({ map: T.signs, vertexColors: true, color: new THREE.Color(1.7, 1.7, 1.7), toneMapped: false }),
  };

  // ───────────── rooms ─────────────
  const A = buildTubeAndConcourse(P, T, env);
  const O = buildOps(P, T, env);
  const L = buildLounge(P, T, env);
  const S = buildLab(P, T, env);

  // ───────────── crew ─────────────
  const kit = createCrewKit(THREE, G);
  const npcs = {};
  const crewMeshes = [];
  const faceYaw = (dx, dz) => Math.atan2(dx, dz);
  const addCrew = (spec, x, y, z, yaw, o = {}) => {
    const c = kit.build(spec);
    c.place(x, y, z, yaw);
    if (o.seat) c.setSeat(kit.chairMesh(o.chairCol), o.seat);
    if (o.look) c.lookAt = V3(...o.look);
    group.add(c.group);
    crewMeshes.push(c);
    P.col(x - (o.seat ? 0.45 : 0.28), y, z - (o.seat ? 0.45 : 0.28), x + (o.seat ? 0.45 : 0.28), y + 1.8, z + (o.seat ? 0.45 : 0.28));
    return c;
  };
  npcs.jonah = addCrew(CREW.jonah, O.spots.capcom[0], O.spots.capcom[1], O.spots.capcom[2], faceYaw(-1, 0), { seat: 0.47, look: [-100, 1.8, 16] });
  npcs.fd = addCrew(CREW.fd, O.spots.rail[0], O.spots.rail[1], O.spots.rail[2], faceYaw(-1, 0), { look: [-100, 2.2, 16] });
  npcs.sci = addCrew(CREW.sci, S.spots.ilse[0], S.spots.ilse[1], S.spots.ilse[2], faceYaw(0, 1), { look: [-75, 2.4, 67.8] });
  npcs.mira = addCrew(CREW.mira, L.spots.mira[0], L.spots.mira[1], L.spots.mira[2], faceYaw(0, -1), { look: [-71, 1.6, -300] });
  // background ops staff (seated at the console rows)
  const STAFF = [
    { id: 'staff0', height: 1.74, build: 1.0, skin: 0xd9ae92, hair: { style: 'short', color: 0x2a1c12 }, outfit: { top: 0x26466d, collar: 0xb9c9d8, pants: 0x1c222b, shoes: 0x14161a, sleeve: 0x26466d }, access: ['headset'], pose: 'sit' },
    { id: 'staff1', height: 1.66, build: 0.92, skin: 0x7a4d33, hair: { style: 'bun', color: 0x120d0a }, outfit: { top: 0x4a2f6a, collar: 0xd0c8e0, pants: 0x1c1c25, shoes: 0x1a1a1f, sleeve: 0x4a2f6a }, access: [], pose: 'sit' },
    { id: 'staff2', height: 1.82, build: 1.08, skin: 0xe2b99c, hair: { style: 'recede', color: 0x8c6a3a }, outfit: { top: 0x2c5a4a, collar: 0xdde6e0, pants: 0x20252b, shoes: 0x111316, sleeve: 0x2c5a4a }, access: ['headset'], pose: 'sit' },
    { id: 'staff3', height: 1.69, build: 0.95, skin: 0xc58a67, hair: { style: 'ponytail', color: 0x1a110c }, outfit: { top: 0x7a3a2a, collar: 0xe8d8c8, pants: 0x23262d, shoes: 0x151618, sleeve: 0x7a3a2a }, access: [], pose: 'sit' },
    { id: 'staff4', height: 1.77, build: 1.04, skin: 0x8e5c40, hair: { style: 'short', color: 0x0e0b09 }, outfit: { top: 0x37383f, collar: 0xc4c7cf, pants: 0x1c1f26, shoes: 0x0f1013, sleeve: 0x37383f }, access: ['headset'], pose: 'sit' },
    { id: 'staff5', height: 1.63, build: 0.9, skin: 0xe6c0a8, hair: { style: 'short', color: 0xb99a63 }, outfit: { top: 0x1f5d78, collar: 0xe2eef2, pants: 0x242a31, shoes: 0x16181c, sleeve: 0x1f5d78 }, access: [], pose: 'sit' },
  ];
  O.staff.forEach(([x, y, z], i) => {
    const c = addCrew(STAFF[i % STAFF.length], x, y, z, faceYaw(-1, 0), { seat: 0.47, chairCol: [0.05, 0.06, 0.08], look: [-100.5, 1.6, z] });
    c.ph += i * 0.9; npcs['staff' + i] = c;
  });

  // ───────────── merge buckets → meshes ─────────────
  for (const [name, bucket] of Object.entries(P.B)) {
    const m = mats[name];
    if (!m) { console.warn('[halcyon] bucket without material:', name); continue; }
    const mesh = bucket.build(m);
    if (mesh) { mesh.name = 'hx_' + name; mesh.matrixAutoUpdate = false; group.add(mesh); }
  }
  // live wall displays refresh at 4 Hz
  let liveClock = 0;
  anims.push((dt, tt) => {
    liveClock -= dt;
    if (liveClock > 0) return;
    liveClock = 0.25;
    T.liveTelemetry.redraw(tt, { tau: (ctx.ship && ctx.ship.tau) || 0, docked: true });
    T.liveGhost.redraw(tt);
    T.liveSentinel.redraw(tt);
  });
  // concourse kiosk: a slow holo ring over the directory pedestal
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.018, 6, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.8, 2.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const ring2 = ring.clone(); ring2.scale.setScalar(0.72);
    const k = new THREE.Group(); k.position.set(...A.kiosk); k.add(ring, ring2); k.position.y = FY + 1.75; group.add(k);
    anims.push((dt, tt) => { ring.rotation.x = tt * 0.7; ring.rotation.y = tt * 0.4; ring2.rotation.y = -tt * 0.9; ring2.rotation.z = tt * 0.5; k.position.y = FY + 1.75 + Math.sin(tt * 1.2) * 0.04; });
  }

  // ───────────── lights: a pool of 6 point lights re-assigned to the nearest fixtures ─────────────
  const POOL = 6;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 20, 2); l.castShadow = false; group.add(l);
    return { light: l, fix: null, k: 0, leaving: false };
  });
  let lightClock = 0;
  function updateLights(dt, eye) {
    lightClock -= dt;
    if (lightClock <= 0) {
      lightClock = 0.2;
      const scored = P.fixtures.map((f) => ({ f, d: f.pos.distanceToSquared(eye) })).sort((a, b) => a.d - b.d).slice(0, POOL);
      const want = new Set(scored.map((s) => s.f));
      for (const p of pool) p.leaving = !!p.fix && !want.has(p.fix);
      for (const s of scored) {
        if (pool.some((p) => p.fix === s.f)) continue;
        const slot = pool.find((p) => !p.fix) || pool.find((p) => p.leaving && p.k < 0.06);
        if (!slot) continue;
        slot.fix = s.f; slot.leaving = false; slot.k = 0;
        slot.light.position.copy(s.f.pos); slot.light.color.setRGB(s.f.rgb[0], s.f.rgb[1], s.f.rgb[2]); slot.light.distance = s.f.dist;
      }
    }
    const a = Math.min(1, dt * 5);
    for (const p of pool) {
      p.k += ((p.fix && !p.leaving ? 1 : 0) - p.k) * a;
      p.light.intensity = p.fix ? p.fix.intensity * p.k : 0;
      if (p.leaving && p.k < 0.02) { p.fix = null; p.leaving = false; p.light.intensity = 0; }
    }
  }

  // ───────────── walkable-space physics (AABB colliders, floor rects) ─────────────
  const floors = P.floors, colliders = P.colliders, ceilings = P.ceilings;
  const STEP = 0.45;
  function floorAt(x, z, yFeet) {
    const lim = yFeet + STEP + 1e-4;
    let best = null;
    for (let i = 0; i < floors.length; i++) {
      const f = floors[i];
      if (x < f.min[0] - 1e-6 || x > f.max[0] + 1e-6 || z < f.min[1] - 1e-6 || z > f.max[1] + 1e-6) continue;
      if (f.y <= lim && (best === null || f.y > best)) best = f.y;
    }
    return best;
  }
  function collide(p, r, h) {
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (c.max[1] <= p.y + 0.05 || c.min[1] >= p.y + h) continue;
        if (p.x < c.min[0] - r || p.x > c.max[0] + r || p.z < c.min[2] - r || p.z > c.max[2] + r) continue;
        const qx = Math.max(c.min[0], Math.min(p.x, c.max[0])), qz = Math.max(c.min[2], Math.min(p.z, c.max[2]));
        const dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else {
          const l = p.x - c.min[0], rr = c.max[0] - p.x, f = p.z - c.min[2], b = c.max[2] - p.z, m = Math.min(l, rr, f, b);
          if (m === l) p.x = c.min[0] - r; else if (m === rr) p.x = c.max[0] + r; else if (m === f) p.z = c.min[2] - r; else p.z = c.max[2] + r;
        }
      }
    }
  }
  function ceilingAt(x, z, yFeet, h) {
    let best = Infinity;
    for (const c of ceilings) if (x >= c.min[0] && x <= c.max[0] && z >= c.min[1] && z <= c.max[1] && c.y > yFeet + h * 0.5 && c.y < best) best = c.y;
    return best;
  }
  const walls = colliders.filter((c) => c.wall);
  function blocked(a, b, ignore) {
    const A3 = Array.isArray(a) ? a : [a.x, a.y, a.z], B3 = Array.isArray(b) ? b : [b.x, b.y, b.z];
    const ign = ignore ? (Array.isArray(ignore) ? ignore : [ignore.x, ignore.y, ignore.z]) : null;
    for (const c of walls) {
      if (ign) {
        const dx = Math.max(c.min[0] - ign[0], 0, ign[0] - c.max[0]), dy = Math.max(c.min[1] - ign[1], 0, ign[1] - c.max[1]), dz = Math.max(c.min[2] - ign[2], 0, ign[2] - c.max[2]);
        if (dx * dx + dy * dy + dz * dz < 0.25) continue;
      }
      let t0 = 0, t1 = 1;
      for (let ax = 0; ax < 3; ax++) {
        const d = B3[ax] - A3[ax];
        if (Math.abs(d) < 1e-9) { if (A3[ax] < c.min[ax] || A3[ax] > c.max[ax]) { t0 = 2; break; } continue; }
        let ta = (c.min[ax] - A3[ax]) / d, tb = (c.max[ax] - A3[ax]) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) break;
      }
      if (t0 <= t1) return true;
    }
    return false;
  }

  // ───────────── conversations ─────────────
  const heardLocal = new Set();
  const isHeard = (id) => heardLocal.has(id) || !!(ctx.flags && ctx.flags.get && ctx.flags.get('hx.heard.' + id));
  const markHeard = (id) => { heardLocal.add(id); safe(() => ctx.flags && ctx.flags.set && ctx.flags.set('hx.heard.' + id, 1)); };
  const lineQ = (id) => (LINES && LINES[id] && LINES[id].q) || FALLBACK_Q[id.replace('halcyon.', '')] || id.split('.').pop();
  /** play a scripted line and resolve when it ends (onEnd, with a text-length fallback timer) */
  function sayWait(id, npc) {
    return new Promise((resolve) => {
      let done = false, timer = 0;
      const fin = () => { if (done) return; done = true; clearTimeout(timer); if (npc) npc.talking = false; resolve(); };
      const text = LINES && LINES[id] ? String(LINES[id].text || '').replace(/\[[^\]]*\]/g, '') : '';
      timer = setTimeout(fin, Math.min(70, Math.max(3.5, text.length * 0.09 + 3)) * 1000);
      if (npc) npc.talking = true;
      try { ctx.say(id, { onEnd: fin }); } catch (e) { fin(); }
    });
  }
  let talkLock = false;
  async function converse(key) {
    if (talkLock) return;
    talkLock = true;
    const cfg = TOPICS[key], npc = npcs[key];
    try {
      await linesReady;
      const hello = `halcyon.${key}.hello`;
      if (!isHeard(hello)) { markHeard(hello); await sayWait(hello, npc); }
      for (;;) {
        const opts = cfg.topics.map((tp) => { const id = `halcyon.${key}.${tp}`; return { label: lineQ(id), done: tp !== 'bye' && isHeard(id) }; });
        const pick = await ctx.ui.choose(cfg.who, opts);
        if (pick == null) break;
        const tp = cfg.topics[pick], id = `halcyon.${key}.${tp}`;
        markHeard(id);
        await sayWait(id, npc);
        if (tp === 'bye') break;
      }
    } catch (e) { console.warn('[halcyon] conversation', e); }
    finally { talkLock = false; if (npc) npc.talking = false; }
  }

  // ───────────── interactables ─────────────
  const interactables = [];
  const toast = (html) => safe(() => ctx.ui && ctx.ui.toast && ctx.ui.toast(html));
  const addIt = (id, label, pos, radius, use, o = {}) => interactables.push({ id, label, pos: V3(...pos), radius, use, ...o });
  const proxy = (c, h = 1.05) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, h, 2, 6), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.y = h / 2 + 0.3 + (c.pose === 'sit' ? -0.25 : 0); m.name = 'hit_' + c.id; c.group.add(m); return m;
  };
  addIt('halcyon.airlock', 'Return to ORPHEUS', A.spots.airlock, 1.5, () => safe(() => ctx.spaces.enter('orpheus', 'airlock')));
  for (const key of ['jonah', 'fd', 'sci', 'mira']) {
    const c = npcs[key], p = c.chestWorld(V3());
    addIt('npc.' + key, NPC_LABEL[key], [p.x, p.y + (key === 'jonah' ? -0.25 : 0), p.z], 0.8, () => converse(key), { object: proxy(c) });
  }
  addIt('halcyon.memorial', 'Memorial wall — EURYDICE', L.spots.memorial, 3.4, () => {
    safe(() => ctx.codex && ctx.codex.unlock && ctx.codex.unlock('vessel.eurydice'));
    toast('<b>EURYDICE · HX-01</b><br>Commander <b>Elena Varis</b> · Flight Engineer <b>Tomas Oyelaran</b><br><i>We leave the light on.</i>');
  }, { object: L.memorial });
  addIt('halcyon.ghost', 'GHOST panel — Eurydice’s frozen image', O.spots.ghost, 3.2, () => {
    safe(() => ctx.codex && ctx.codex.unlock && ctx.codex.unlock('erebus.horizon'));
    toast('<b>GHOST</b> — tracking Eurydice’s frozen image on Erebus’s horizon.<br>Her last light, redshifted past visibility, still arriving. Eleven years of integration; the station has not stopped watching.');
  }, { object: O.screens.ghost });
  addIt('halcyon.window', 'Look out at Erebus', L.spots.window, 3.4, () => {
    safe(() => ctx.ui && ctx.ui.cine && ctx.ui.cine('EREBUS', 'Kerr black hole · 2.03×10⁵ solar masses · Halcyon holds at forty-six gravitational radii', false, 5200));
  });
  addIt('halcyon.telescope', 'Telescope', L.spots.telescope, 1.4, () => toast('A brass-and-carbon telescope on a tripod, pointed at the one patch of horizon where Eurydice’s image would be. The eyepiece is worn smooth.'));
  addIt('halcyon.mural', 'ORPHEUS mission patch', [-47.4, 2.55, 16], 4.4, () => toast('<b>ORPHEUS · HX-02</b><br>The mission patch — a lyre whose strings fall into the dark. Halcyon’s school painted it, one sector each.'), { object: A.mural });
  addIt('halcyon.kiosk', 'Station directory', A.kiosk.map((v, i) => (i === 1 ? FY + 0.8 : v)), 1.3, () => toast('<b>HALCYON STATION</b> · directory<br>Operations ▸ west · Observation lounge ▸ north of Operations · Science ▸ south · Crew quarters ▸ off the concourse'));
  addIt('halcyon.erebus', 'Erebus display', O.spots.erebus, 3.0, () => toast('<b>EREBUS</b> · XRB-J1840<br>Kerr black hole, 2.03×10⁵ M☉, a* = 0.95. Halcyon orbits at 46 gravitational radii.'), { object: O.screens.erebus });
  addIt('halcyon.telemetry', 'ORPHEUS telemetry', O.spots.telemetry, 3.4, () => toast('<b>ORPHEUS · HX-02</b> — docked at berth 01. Hull nominal, reactor 100 %, drive safe. LYRA online.'), { object: O.screens.telemetry });
  addIt('halcyon.hologram', 'Hologram — Erebus', S.spots.holo, 2.2, () => toast('A live model of Erebus: horizon, ergosphere, a slow-turning disk. Dr. Varga rebuilds it whenever the measured spin drifts.'), { object: group.getObjectByName('hologram') });
  addIt('halcyon.whiteboard', 'Whiteboard', S.spots.board, 2.8, () => toast('Dr. Varga’s whiteboard: the Kerr horizons, the ergosphere, a Penrose diagram — and, circled in red, <i>Eurydice: z → ∞ — still tracking.</i>'), { object: group.getObjectByName('whiteboard') });
  addIt('halcyon.sentinel', 'Sentinel feed — Charon', S.spots.sentinel, 3.0, () => toast('Live from the Sentinel telescope on Charon: a smudge of dull red on the horizon. Eleven years of exposure, one patch of sky.'), { object: group.getObjectByName('screen_sentinel') });
  addIt('halcyon.quarters', 'Crew quarters', A.spots.quarterDoor, 1.6, () => toast('Crew quarters. The door is sealed — privacy lock engaged. Someone has taped a child’s drawing of a ship to the nameplate.'));

  // ───────────── PA announcements ─────────────
  let paTimer = 0, paIdx = 0;
  const resetPA = () => { paTimer = 28 + Math.random() * 25; };
  resetPA();

  // ───────────── update ─────────────
  let t = 0, wasVisible = false;
  const camPos = V3();
  function update(dt) {
    if (!group.visible) { wasVisible = false; return; }
    if (!wasVisible) { resetPA(); wasVisible = true; }
    dt = Math.min(dt, 0.1);
    t += dt;
    const cam = ctx.cameras && ctx.cameras.near;
    if (cam) cam.getWorldPosition(camPos); else camPos.set(-8, 0.4, 16);
    updateLights(dt, camPos);
    for (const c of crewMeshes) c.update(dt, t, camPos);
    for (const fn of anims) fn(dt, t, camPos);
    if (!talkLock) {
      paTimer -= dt;
      if (paTimer <= 0) {
        paIdx = (paIdx % 4) + 1;
        safe(() => ctx.say('halcyon.pa.' + paIdx, { priority: 'low' }));
        paTimer = 70 + Math.random() * 50;
      }
    }
  }

  const space = {
    id: 'halcyon', name: 'Halcyon Station', group, gravity: 9.81,
    spawn: { pos: [-8.2, FY, 16], yaw: Math.PI / 2 },
    floorAt, collide, ceilingAt, blocked,
    interactables, rooms: P.rooms,
    footstep: (pos) => (pos.x > -17.5 ? 'grate' : 'metal'),
    update,
  };
  return { group, space, update, crew: npcs };
}
