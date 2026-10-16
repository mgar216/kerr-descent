// ORPHEUS · UI harness — drives overlay / dialogue / codex / nav computer against a FAKE ctx (worlds come from src/world/catalog.js).
//   dev/ui.html                   → dev buttons top-right; keys wired like core: J = nav computer, ` (Backquote) = codex
//   dev/ui.html?bar=0&demo=nav    → hide the dev bar and auto-run a demo: nav | anti | navside | codex | logs | dialogue | prompt | subtitle | room | fade
//   &freeze=1                     → stop the simulated flight (stable positions for screenshots / clicks)
//   &sheet=-1 &discover=1         → ship on the r < 0 sheet · mark Eurydice / Elysium as charted
//   &lock=landed|docked           → ship.lock set (nav.setCourse then refuses, like core)
//   &real=1                       → use the real src/story/codex.js instead of the built-in sample data
//   &noworlds=1 / &nocodex=1      → exercise the "module missing" paths
import { createOverlay } from '../src/ui/overlay.js';
import { createDialogue } from '../src/ui/dialogue.js';
import { createCodex } from '../src/ui/codex.js';
import { createNavComputer } from '../src/ui/navmap.js';
import { bodies as CATALOG } from '../src/world/catalog.js';

const Q = new URLSearchParams(location.search);
const D2R = Math.PI / 180, KM_PER_M = 299792.458;
const logEl = document.getElementById('devlog');
const log = (s) => { logEl.textContent = (logEl.textContent + '\n' + s).split('\n').slice(-14).join('\n').trim(); };
if (Q.get('bar') === '0') document.body.classList.add('nobar');

// ─────────────────────────── backdrop (stand-in for the ray-traced scene) ───────────────────────────
(function backdrop() {
  const cv = document.getElementById('bg'), g = cv.getContext('2d');
  const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  g.fillStyle = '#01040a'; g.fillRect(0, 0, W, H);
  let s = 7; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(210,230,255,${0.1 + rnd() * 0.6})`; g.fillRect(rnd() * W, rnd() * H, 1 + (rnd() > 0.96), 1 + (rnd() > 0.96)); }
  const cx = W * 0.5, cy = H * 0.46, R = Math.min(W, H) * 0.16;
  const halo = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 3.4);
  halo.addColorStop(0, 'rgba(255,190,110,.55)'); halo.addColorStop(0.35, 'rgba(255,120,50,.18)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo; g.fillRect(0, 0, W, H);
  g.save(); g.translate(cx, cy); g.rotate(-0.12);
  for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(0, 0, R * (1.5 + i * 0.28), R * (0.2 + i * 0.05), 0, 0, Math.PI * 2); g.strokeStyle = `rgba(255,${190 - i * 20},${120 - i * 14},${0.5 - i * 0.07})`; g.lineWidth = 6 - i * 0.7; g.stroke(); }
  g.restore();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = '#000'; g.fill();
  g.beginPath(); g.arc(cx, cy, R * 1.04, 0, Math.PI * 2); g.strokeStyle = 'rgba(255,230,190,.8)'; g.lineWidth = 2; g.stroke();
})();

// ─────────────────────────── Kerr stand-ins (same formulas as core.js) ───────────────────────────
const A = 0.95;
const K = (() => {
  const q = Math.sqrt(1 - A * A), z1 = 1 + Math.cbrt(1 - A * A) * (Math.cbrt(1 + A) + Math.cbrt(1 - A)), z2 = Math.sqrt(3 * A * A + z1 * z1);
  return { a: A, rp: 1 + q, rm: 1 - q, isco: 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2)),
    phPro: 2 * (1 + Math.cos((2 / 3) * Math.acos(-A))), phRet: 2 * (1 + Math.cos((2 / 3) * Math.acos(A))) };
})();
const kerr = {
  rErgo: (th) => 1 + Math.sqrt(Math.max(0, 1 - A * A * Math.cos(th) ** 2)),
  ksPoint: (r, th, ph) => [(r * Math.cos(ph) - A * Math.sin(ph)) * Math.sin(th), (r * Math.sin(ph) + A * Math.cos(ph)) * Math.sin(th), r * Math.cos(th)],
};

// ─────────────────────────── fake ship ───────────────────────────
const ship = { S: new Float64Array(20), sheet: 1, tau: 754, universe: 0, lock: Q.get('lock') ? { kind: Q.get('lock'), body: 'asphodel' } : null, guide: false };
const obs = { r: 30, region: 'EXTERIOR' };
let shipPhase = 0.7;
function placeShipOnOrbit(t) {
  const r = 30, w = 1 / (Math.pow(r, 1.5) + A), ph = shipPhase + w * t;
  const S = ship.S;
  S[0] = t; S[1] = r * Math.cos(ph); S[2] = r * Math.sin(ph); S[3] = 2.5;
  S[4] = 1.05; S[5] = -Math.sin(ph) * r * w * 1.05; S[6] = Math.cos(ph) * r * w * 1.05; S[7] = 0;
  S[9] = -Math.sin(ph); S[10] = Math.cos(ph); S[11] = 0;                    // forward = prograde tangent
  obs.r = Math.hypot(S[1], S[2], S[3]);
}
placeShipOnOrbit(1800);
function putShipAntiverse() {
  const S = ship.S;
  ship.sheet = -1; ship.universe = 0; obs.region = 'ANTIVERSE'; obs.r = -42;
  S[1] = 22; S[2] = -14; S[3] = -31; S[9] = 0.5; S[10] = 0.2; S[11] = -0.84; S[5] = S[6] = S[7] = 0; S[4] = 1;
}
function putShipExterior() { ship.sheet = 1; obs.region = 'EXTERIOR'; placeShipOnOrbit(ship.S[0]); }

// ─────────────────────────── fake worlds (positions from the real catalog formulas) ───────────────────────────
const flags = { eurydiceKnown: false, elysiumKnown: false };
function bodyPos(b, t) {
  if (b.fixed) return b.fixed.pos.map((c, i) => c + b.fixed.vel[i] * t);
  const o = b.orbit, inc = (o.inc || 0) * D2R, node = (o.node || 0) * D2R, ph = o.phase * D2R;     // Charon: orbit in Lethe's equatorial plane (no inc/node in the catalog)
  const w = o.period ? (2 * Math.PI) / o.period : 1 / (Math.pow(o.r, 1.5) + A * Math.cos(inc)), th = ph + w * t;
  const p = [o.r * (Math.cos(node) * Math.cos(th) - Math.sin(node) * Math.cos(inc) * Math.sin(th)), o.r * (Math.sin(node) * Math.cos(th) + Math.cos(node) * Math.cos(inc) * Math.sin(th)), o.r * Math.sin(inc) * Math.sin(th)];
  if (o.parent) { const par = CATALOG.find((x) => x.id === o.parent); const pp = bodyPos(par, t); return [p[0] + pp[0], p[1] + pp[1], p[2] + pp[2]]; }
  return p;
}
const worlds = {
  catalog: CATALOG,
  bodyState: (id, t) => { const b = CATALOG.find((x) => x.id === id); if (!b) return null; return { pos: bodyPos(b, t), sheet: b.sheet }; },
  destinations() {
    const t = ship.S[0], S = ship.S;
    return CATALOG.map((b) => {
      const p = bodyPos(b, t), dist = Math.hypot(p[0] - S[1], p[1] - S[2], p[2] - S[3]);
      const here = (ship.sheet > 0) === (b.sheet > 0);
      const discovered = b.id === 'eurydice' ? flags.eurydiceKnown : b.id === 'elysium' ? flags.elysiumKnown : true;
      const r = Math.hypot(...p);
      return { id: b.id, name: b.name, group: b.group, kind: b.kind, reachable: here, why: here ? '' : b.sheet < 0 ? 'No path from the positive sheet — the ring is one-way.' : 'No way back. The horizon only lets you in.',
        dist, lag: dist, dilation: b.sheet > 0 ? Math.sqrt(Math.max(0.01, 1 - 3 / r + (2 * A) / Math.pow(r, 1.5))) / (1 + A / Math.pow(r, 1.5)) : 1.0004,
        landable: !!b.landable, dockable: !!b.dockable, sites: b.sites, discovered, desc: b.desc, radiusKm: b.radiusKm };
    });
  },
};
function navFeatures() {
  const S = ship.S, inside = ship.sheet > 0 && obs.r < K.rp;
  const pos = { DSK: kerr.ksPoint(15, 80 * D2R, 40 * D2R), PHS: kerr.ksPoint(3, 60 * D2R, 120 * D2R), ISC: kerr.ksPoint(K.isco + 0.35, 78 * D2R, 200 * D2R), POL: kerr.ksPoint(4, 12 * D2R, 300 * D2R),
    ERG: kerr.ksPoint(K.rp + 0.02, 8 * D2R, 330 * D2R), EHZ: kerr.ksPoint(K.rp - 0.15, 5 * D2R, 330 * D2R), IHZ: kerr.ksPoint(0.57, 3 * D2R, 330 * D2R), RNG: [0, 0, -0.3], ANV: [0, 0, -15] };
  const names = { DSK: 'DISK RIM', PHS: 'PHOTON SHELL', ISC: 'ISCO GATE', POL: 'POLAR GATE', ERG: 'ERGOSPHERE', EHZ: 'EVENT HORIZON', IHZ: 'INNER HORIZON', RNG: 'RING THROAT', ANV: 'ANTIVERSE' };
  const kinds = { ERG: 'ergo', EHZ: 'horizon', IHZ: 'inner', RNG: 'ring', ANV: 'anti' }, deep = ship.sheet > 0 && obs.r < K.rm;
  const reach = (id) => {                                      // same rules as core.js featureReach()
    const k = kinds[id] || 'point';
    if (ship.sheet < 0) return k === 'anti' ? [true, ''] : [false, 'no path back through the ring'];
    if (deep) return ['ring', 'anti'].includes(k) ? [true, ''] : [false, 'inside the inner horizon'];
    if (inside) return ['inner', 'ring', 'anti'].includes(k) ? [true, ''] : [false, 'inside the event horizon'];
    return [true, ''];
  };
  return Object.keys(names).map((id) => {
    const p = pos[id], [reachable, why] = reach(id);
    return { id, name: names[id], kind: kinds[id] || 'point', reachable, why, done: id === 'DSK' || id === 'PHS', dist: Math.hypot(p[0] - S[1], p[1] - S[2], p[2] - S[3]) };
  });
}
const navState = { id: null };                                // mirrors core: current() is the target object itself, a course = ship.guide
const nav = {
  setCourse: (id, o) => { if (ship.lock) { log('nav.setCourse refused: ship is locked'); return false; } navState.id = id; ship.guide = true; log(`nav.setCourse(${id}, ${JSON.stringify(o)})`); return true; },
  setTarget: (id) => { navState.id = id; ship.guide = false; log(`nav.setTarget(${id})`); return true; },
  clear: () => { navState.id = null; ship.guide = false; log('nav.clear()'); },
  current: () => (navState.id ? { id: navState.id, name: navState.id, kind: 'body' } : null),
};
function hudPred() {                                          // predicted path: continue on the orbit, then spiral inward
  const S = ship.S, out = [];
  let ph = Math.atan2(S[2], S[1]), r = Math.hypot(S[1], S[2]);
  for (let i = 0; i < 40; i++) { ph += 0.012; r -= 0.18 * (i / 40) ** 2 * 8; out.push([r * Math.cos(ph), r * Math.sin(ph), S[3] * (1 - i / 40)]); }
  return out;
}

// ─────────────────────────── sample codex ───────────────────────────
const P = (...p) => p.join('\n\n');
const SAMPLE = {
  'erebus': { title: 'Erebus', category: 'Erebus', body: P('Halcyon\'s name for catalogue object XRB-J1840: a 203,000-solar-mass black hole spinning at ninety-five percent of the maximum a black hole can have.', 'One gravitational radius, *M*, is one light-second — about 299,792 kilometres. Everything in the system is measured in it.') },
  'erebus.disk': { title: 'Accretion disk', category: 'Erebus', body: P('A starved, cool flow of gas spiralling in from 17 M down to the innermost stable orbit. It is the only sun this system has.', 'The half of the disk rotating toward you is blueshifted and beamed, which is why one side burns brighter.') },
  'erebus.photon': { title: 'Photon shell', category: 'Erebus', body: 'Between about 1.4 and 4.0 M, light itself can circle the hole. Looking at it, every star in the sky appears more than once.' },
  'erebus.ergosphere': { title: 'Ergosphere', category: 'Erebus', body: P('Inside this oblate shell space itself is dragged around faster than light can move against it. Nothing can hold still — not even a ship with its engines at full burn.', 'It is also where, in principle, you could steal energy from the hole: the Penrose process.') },
  'erebus.horizon': { title: 'Event horizon', category: 'Erebus', body: 'The point of no return. Nothing at the horizon feels special to the one falling in; every future simply points inward.' },
  'world.halcyon': { title: 'Halcyon Station', category: 'Worlds', body: 'Research station and mission control. Fourteen years in orbit at 46 M. Crew of around 180, many with families aboard. A thirty-three-minute year.' },
  'world.asphodel': { title: 'Asphodel', category: 'Worlds', body: P('Tidally locked ocean-archipelago world. Silver-grey meadows, black sand, shallow turquoise seas. Erebus hangs fixed in the sky.', '0.86 g · 0.8 atm N₂/O₂.') },
  'world.phlegethon': { title: 'Phlegethon', category: 'Worlds', body: 'Tidally heated iron world — lava rivers, ash haze, sulphur dioxide.' },
  'world.lethe': { title: 'Lethe', category: 'Worlds', body: 'A ringed gas giant, pale blue-violet. Not landable; Charon is its ice-moon.' },
  'world.cocytus': { title: 'Cocytus', category: 'Worlds', body: 'Frozen world: −190 °C, blue ice plains, howling cryo-geysers under a dim twilight.' },
  'world.elysium': { title: 'Elysium', category: 'Worlds', body: 'A rogue world in the negative-mass universe. Crystalline silicate plains that phosphoresce under the giant spiral galaxy of the anti-sky.' },
  'vessel.orpheus': { title: 'ORPHEUS (HX-02)', category: 'Vessels', body: P('Exploration torch-ship, 48 metres long. White ceramic hull, carbon trims, orange-and-cyan stripes, a lyre painted on the flank.', 'Her crew is decoupled from the acceleration: she can burn at ten million g and nobody feels it. In-fiction, that is also why she is indestructible.') },
  'vessel.halcyon': { title: 'Halcyon Station', category: 'Vessels', body: 'Ring habitat with a spindle docking core. 1.6 km across. Mission control for the ORPHEUS descent.' },
  'vessel.eurydice': { title: 'EURYDICE (HX-01)', category: 'Vessels', body: 'ORPHEUS\'s sister ship, lost eleven years ago on an ergosphere survey. From outside, she is frozen at the horizon forever — redshifted to invisibility.' },
  'person.lyra': { title: 'LYRA', category: 'People', body: 'ORPHEUS\'s shipboard intelligence, named for the lyre. Calm, exact, dryly funny, and protective of the Commander.' },
  'person.jonah': { title: 'Jonah Reyes', category: 'People', body: 'CAPCOM. The voice from Halcyon you hear most. Warm, steady, an old friend of the Commander.' },
  'person.bell': { title: 'Director Arthur Bell', category: 'People', body: 'Flight Director. Older, measured, carries the weight of the programme — and of EURYDICE.' },
  'person.varga': { title: 'Dr. Ilse Varga', category: 'People', body: 'Science lead. Built the Sentinel telescope on Charon and has watched EURYDICE\'s frozen image for eleven years.' },
  'person.mira': { title: 'Mira', category: 'People', body: 'The Commander\'s daughter. Sixteen. Funny, sharp, brave, aching.' },
  'person.elena': { title: 'Elena Varis', category: 'People', body: 'Commander of EURYDICE. Mira\'s mother. The Commander\'s partner.' },
  'person.tomas': { title: 'Tomas Oyelaran', category: 'People', body: 'EURYDICE\'s flight engineer. Gentle, funny, Nigerian-British.' },
  'physics.dilation': { title: 'Time dilation', category: 'Physics', body: P('Clocks run slower deeper in a gravity well and slower the faster they move. Near Erebus both effects stack.', 'A clock in Halcyon\'s orbit runs at about 0.97 of the rate of a clock far away.') },
  'physics.lag': { title: 'Light lag & redshift', category: 'Physics', body: 'One gravitational radius is one light-second. A message to a world 800 M away takes thirteen minutes to arrive, and redshift stretches it on the way up out of the well.' },
  'physics.framedrag': { title: 'Frame dragging', category: 'Physics', body: 'A spinning mass drags spacetime around with it — the Lense–Thirring effect. At ninety-five percent of maximum spin the drag near the hole is ferocious.' },
  'physics.tides': { title: 'Tidal forces', category: 'Physics', body: 'Gravity differs from head to feet. For a hole this large the horizon tides are gentle; for a small one they would be lethal long before the horizon.' },
  'log.eur.1': { title: 'EURYDICE LOG 1 — THE CROSSING', category: 'Logs', voice: 'eur.log.1', body: 'Elena records the moment EURYDICE crosses the event horizon. Nothing feels different.' },
  'log.eur.2': { title: 'EURYDICE LOG 2 — THE INNER HORIZON', category: 'Logs', voice: 'eur.log.2', body: 'Tomas on the inner horizon and the ring.' },
  'log.eur.3': { title: 'EURYDICE LOG 3 — THE SKY', category: 'Logs', voice: 'eur.log.3', body: 'Elena, on the impossible sky of the other side.' },
  'log.eur.4': { title: 'EURYDICE LOG 4 — FAILING SYSTEMS', category: 'Logs', voice: 'eur.log.4', body: 'Tomas, on the food mathematics.' },
  'log.asphodel.1': { title: 'ASPHODEL SURVEY LOG A', category: 'Logs', voice: 'log.asphodel.1', body: 'Okafor describes the first night at Meadow Base.' },
  'log.charon.1': { title: 'SENTINEL LOG', category: 'Logs', voice: 'log.charon.1', body: 'Dr. Varga, watching EURYDICE\'s frozen image for eleven years.' },
};

// ─────────────────────────── build the ctx and the real UI modules ───────────────────────────
const sayLog = [];
const ctx = {
  ship, obs, K, kerr, units: { DEG: D2R, KM_PER_M },
  worlds: Q.get('noworlds') ? null : worlds,
  navFeatures: Q.get('noworlds') ? null : navFeatures,
  nav, hudPred,
  audio: { ui: (k) => { if (k !== 'click') log(`audio.ui(${k})`); } },
  say: (id, o) => { log(`say(${id})`); sayLog.push(id); if (o && o.onEnd) setTimeout(o.onEnd, 2600); },
  bus: { on() {}, off() {}, emit() {} },
  input: { keys: new Set(), locked: () => false, requestLock() { log('input.requestLock()'); } },
};
const ov = createOverlay();
const dlg = createDialogue(ctx);
const codex = createCodex(ctx, Q.get('nocodex') ? { data: null } : Q.get('real') ? {} : { data: SAMPLE });     // default close key: Backquote (as bound in core.js)
const navUI = createNavComputer(ctx, { keys: ['KeyJ'] });
ctx.ui = { ...ov, choose: dlg.choose };
ctx.codex = codex; ctx.codexUI = codex; ctx.navComputer = navUI;
window.__ui = { ctx, ov, dlg, codex, nav: navUI, flags, putShipAntiverse, putShipExterior };

// stands in for core's window keydown handler: J / K open, everything else is "game input" (must stay silent while a modal is open)
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyJ') { navUI.toggle(); return; }
  if (e.code === 'Backquote') { codex.toggle(); return; }
  log(`game saw key ${e.code}`);
});
addEventListener('wheel', () => log('game saw wheel'), { passive: true });

// the ship keeps flying while the computer is open
let simT = ship.S[0];
if (!Q.get('freeze')) setInterval(() => { if (ship.sheet > 0 && !ship.lock) { simT += 4; placeShipOnOrbit(simT); } }, 100);

// ─────────────────────────── dev bar ───────────────────────────
const bar = document.getElementById('dev');
const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { b.blur(); fn(); }; bar.appendChild(b); };
btn('NAV [J]', () => navUI.toggle());
btn('ANTIVERSE', () => navUI.open({ tab: 'anti' }));
btn('SIDE', () => navUI.open({ view: 'side' }));
btn('CODEX [`]', () => codex.toggle());
btn('LOGS', () => codex.open('Logs'));
btn('UNLOCK', () => { const ids = ['world.asphodel', 'world.phlegethon', 'vessel.eurydice', 'person.tomas', 'log.eur.3', 'log.charon.1', 'world.elysium', 'world.lethe']; const id = ids.find((x) => !codex.isUnlocked(x)); if (id) codex.unlock(id); else log('all sample entries unlocked'); });
btn('DIALOGUE', () => demoDialogue());
btn('PROMPT', () => { ov.prompt('<kbd>E</kbd> Use · galley coffee machine'); ov.crosshair(true); });
btn('NO PROMPT', () => ov.prompt(null));
btn('SUBTITLE', () => ov.subtitle('LYRA', '[calm] Reading the field now. Halcyon is sixteen light-seconds behind us — which means everything they say is already a little bit history.', 6000));
btn('ROOM', () => ov.toastRoom('Galley'));
btn('FADE', () => ov.fade(true, 700).then(() => setTimeout(() => ov.fade(false, 900), 400)));
btn('SHEET ±', () => { if (ship.sheet > 0) putShipAntiverse(); else putShipExterior(); });
btn('DISCOVER', () => { flags.eurydiceKnown = true; flags.elysiumKnown = true; });
btn('RESET CODEX', () => { localStorage.removeItem('orpheus.codex.v1'); location.reload(); });

async function demoDialogue() {
  const i = await dlg.choose('LYRA — ask a question', [
    { label: 'Who are you, really?' }, { label: 'What is the Kerr geometry?', done: true }, { label: 'Why is there no way back?' },
    { label: 'How does time work near the hole?', sub: 'Proper time vs. Halcyon\'s clock' }, { label: 'What is the ergosphere?' },
    { label: 'Tell me about the ring.', disabled: true, sub: 'Not yet — ask again after the horizon.' }, { label: 'Is there anything on the other side?' },
    { label: 'Are you afraid?' }, { label: 'Tell me about Eurydice.' }, { label: 'What was the myth?' }, { label: 'Never mind.' },
  ]);
  log(`dialogue → ${i}`);
}

// ─────────────────────────── demos for screenshots ───────────────────────────
const demo = Q.get('demo');
if (Q.get('discover')) { flags.eurydiceKnown = flags.elysiumKnown = true; }
if (Q.get('sheet') === '-1') putShipAntiverse();
if (demo) {
  const run = {
    nav: () => navUI.open(), anti: () => navUI.open({ tab: 'anti' }), navside: () => navUI.open({ view: 'side' }),
    codex: () => codex.open(), logs: () => { codex.unlock('log.eur.3'); codex.unlock('log.charon.1'); codex.open('Logs'); },
    dialogue: () => demoDialogue(),
    prompt: () => { ov.crosshair(true); ov.prompt('<kbd>E</kbd> Use · galley coffee machine'); ov.subtitle('LYRA', '[dry] Your coffee is ready. I would call it a minor miracle of engineering, but it is mostly just coffee.', 0); },
    subtitle: () => ov.subtitle('MIRA', 'Hey. It is me. I am recording this in the hallway outside the observation deck, which is the only place on Halcyon with a signal and no one watching.', 0),
    room: () => ov.toastRoom('Galley'),
    fade: () => ov.fade(true, 100),
  }[demo];
  setTimeout(() => run && run(), Number(Q.get('delay') || 450));
}
