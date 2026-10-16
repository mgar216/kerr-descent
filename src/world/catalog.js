// ORPHEUS — world catalog (data only). Units: positions/lengths in M (1 M = 1 light-second = 299,792.458 km), time in
// coordinate seconds, angles in degrees unless stated. Consumed by src/world/space.js (physics, rendering, nav) and by
// SURFACE / NAV UI agents (read-only).
//
// ── Conventions (binding for everyone who reads site lat/lon) ───────────────────────────────────────────────────────
//  Body-fixed frame of a world:   X → toward its light source (Erebus; Charon: toward Lethe; Elysium: toward the
//                                     anti-sky galaxy),   Z → north = orbit normal (Elysium/Lethe: spin axis),   Y = Z × X.
//  Site normal:  n(lat, lon) = (cos lat cos lon, cos lat sin lon, sin lat)   (lon east = +Y).
//  Tidally locked worlds never rotate relative to that frame, so Erebus' elevation at a site is asin(cos lat · cos lon).
//  Landed ship attitude: up = n, forward = local north, right = east  →  ship space (x = east, y = up, z = −north).
//  Antiverse worlds are kinematic (not geodesic): they sit on sheet −1 with a slow imposed outward drift.
//  Stations / derelicts: local frame +X prograde, +Y orbit normal, +Z radially outward (Halcyon); see `frame` below.

export const KM_PER_M = 299792.458;
const km = (v) => v / KM_PER_M;

// Orbital angular rate (coordinate time): ω = 1/(r^1.5 + a·cos i)  — the Kerr equatorial prograde formula with the spin term
// scaled by cos i for inclined orbits (a = ctx.K.a at runtime). Charon uses its fixed 6.6 h period around Lethe.

// ── lighting model (pre-exposure radiance units of the ray-traced background) ────────────────────────────────────────
export const LIGHT = {
  refDist: 140,                         // M — Asphodel's orbit
  white140: 0.30,                       // radiance of a white Lambertian surface lit face-on at 140 M from Erebus
  col: [1.0, 0.93, 0.80],               // light colour of the (cool, starved) accretion flow
  srcRadiusM: 17,                       // accretion-disk outer radius → angular size of the light source (soft terminators)
  // antiverse: the giant spiral of the anti-sky (core makeSky: spiral(normalize(0.3,-0.55,-0.78), size 0.30, bright 1.6))
  galaxyDir: (() => { const v = [0.3, -0.55, -0.78], l = Math.hypot(...v); return v.map((c) => c / l); })(),
  galaxyCol: [0.78, 0.90, 1.35],
  galaxyWhite: 0.11,                    // radiance of a white face-on surface lit by the galaxy
  galaxyAngRadius: 0.30,                // rad — apparent size of the galaxy (terminator softness)
  galaxy2Dir: (() => { const v = [-0.8, 0.35, 0.5], l = Math.hypot(...v); return v.map((c) => c / l); })(),
  galaxy2Col: [1.3, 0.9, 0.8],
  galaxy2White: 0.025,
  // far-pass auto-gain: dim worlds are exposed up to this factor above the pipeline exposure (keeps Lethe/Cocytus legible)
  adaptMax: 24,
  adaptTarget: 1.5,                     // display luminance the gain aims for on a lit white surface
};

// ── bodies ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// orbit: { parent, r (M), inc, node, phase }  circular & prograde; position at t:  θ = phase + ω t,
//   p = r·( cosΩ cosθ − sinΩ cos i sinθ,  sinΩ cosθ + cosΩ cos i sinθ,  sin i sinθ ) (+ parent position)
// fixed: { pos, vel } for antiverse bodies (kinematic drift).
// frame: how the body-fixed frame is built (see header).
const BODIES = [
  {
    id: 'halcyon', name: 'Halcyon Station', label: 'HALCYON', kind: 'station', group: 'STATIONS', sheet: 1,
    desc: 'Research station and mission control. Dockable.',
    radiusKm: 0.8, g: 1.0, landable: false, atmosphere: null,
    orbit: { parent: null, r: 46, inc: 6, node: -142, phase: 90 },        // t = 0 → azimuth −52°, latitude +6°
    frame: { type: 'orbit' },
    standoffKm: 0.6, capKm: 0.05, approachGapKm: 0.25, approachM: 25, meshRangeKm: 250,
    dockable: true, port: { pos: [0, 90, 0], normal: [0, 1, 0], up: [0, 0, 1] }, // fallback if the model publishes none (metres, station-local)
    look: { albedo: 0.55, color: [0.8, 0.82, 0.85], beacon: [1.0, 0.62, 0.15] },
    lines: { approach: 'halcyon.approach', mcApproach: 'halcyon.mc.approach', arrive: 'halcyon.arrive', dock: 'halcyon.dock', undock: 'halcyon.undock', cmdrDock: 'cmdr.dock.request', cmdrUndock: 'cmdr.undock' },
    codex: 'world.halcyon', sites: [],
  },
  {
    id: 'asphodel', name: 'Asphodel', label: 'ASPHODEL', kind: 'planet', group: 'WORLDS', sheet: 1,
    desc: 'Tidally locked ocean-archipelago world. Silver-grey meadows, black sand, shallow turquoise seas.',
    radiusKm: 5400, g: 0.86, landable: true,
    atmosphere: { pressure: 0.8, color: [0.30, 0.58, 1.0], density: 1.0, haze: 0.5, height: 0.020, desc: 'N₂/O₂, 0.8 atm' },
    orbit: { parent: null, r: 140, inc: 3, node: 20, phase: -40 },
    frame: { type: 'locked', to: 'erebus' },
    standoffR: 3.0, capR: 0.35, approachM: 25,
    look: { albedo: 0.34, color: [0.30, 0.45, 0.50], seed: 3.1 },
    lines: { approach: 'world.asphodel.approach', arrive: 'world.asphodel.arrive', scan: 'world.asphodel.scan', mc: 'world.asphodel.mc', land: 'world.asphodel.land', surface: 'world.asphodel.surface', takeoff: 'world.asphodel.takeoff' },
    codex: 'world.asphodel',
    sites: [
      { id: 'meadow', name: 'Meadow Base', lat: 14, lon: 48, desc: 'Survey outpost in the silver meadows.' },
      { id: 'shore', name: 'Grey Shore', lat: -8, lon: 72, desc: 'Black beach under a low Erebus. A crashed survey drone.' },
    ],
  },
  {
    id: 'phlegethon', name: 'Phlegethon', label: 'PHLEGETHON', kind: 'planet', group: 'WORLDS', sheet: 1,
    desc: 'Tidally heated iron world. Basalt plains, lava rivers, ash haze, sulphur dioxide.',
    radiusKm: 4100, g: 1.2, landable: true,
    atmosphere: { pressure: 0.35, color: [0.86, 0.52, 0.30], density: 1.25, haze: 0.9, height: 0.022, desc: 'SO₂ and volcanic ash, 0.35 atm' },
    orbit: { parent: null, r: 118, inc: 9, node: -60, phase: -35 },
    frame: { type: 'locked', to: 'erebus' },
    standoffR: 3.0, capR: 0.35, approachM: 25,
    look: { albedo: 0.07, color: [0.10, 0.07, 0.06], seed: 7.7 },
    lines: { approach: 'world.phlegethon.approach', arrive: 'world.phlegethon.arrive', scan: 'world.phlegethon.scan', mc: 'world.phlegethon.mc', land: 'world.phlegethon.land', surface: 'world.phlegethon.surface', takeoff: 'world.phlegethon.takeoff' },
    codex: 'world.phlegethon',
    sites: [
      { id: 'ridge', name: 'Cinder Ridge', lat: 22, lon: -35, desc: 'Seismic station over a lava river.' },
      { id: 'forge', name: 'The Forge', lat: -10, lon: 84, desc: 'Terminator ground. An abandoned lander.' },
    ],
  },
  {
    id: 'lethe', name: 'Lethe', label: 'LETHE', kind: 'gasgiant', group: 'WORLDS', sheet: 1,
    desc: 'Ringed gas giant. Pale blue-violet bands and storms; rings from 1.3 to 2.0 radii.',
    radiusKm: 58000, g: 1.6, landable: false,
    atmosphere: { pressure: null, color: [0.50, 0.60, 1.0], density: 1.4, haze: 0.30, height: 0.012, desc: 'H₂/He, hydrocarbon haze' },
    orbit: { parent: null, r: 800, inc: 22, node: 135, phase: -193 },
    frame: { type: 'spin', tilt: 26.7, azimuth: -58 },                       // spin axis = ring normal
    spinPeriod: 36000,                                                      // 10 h
    rings: { inner: 1.30, outer: 2.00 },
    standoffR: 2.6, capR: 0.30, approachM: 25,
    look: { albedo: 0.50, color: [0.58, 0.62, 0.82], seed: 1.9 },
    lines: { approach: 'world.lethe.approach', arrive: 'world.lethe.arrive', scan: 'world.lethe.scan', mc: 'world.lethe.mc', rings: 'world.lethe.rings' },
    codex: 'world.lethe', sites: [],
  },
  {
    id: 'charon', name: 'Charon', label: 'CHARON', kind: 'moon', group: 'WORLDS', sheet: 1,
    desc: 'Airless ice-rock moon of Lethe. Lethe fills 47° of its sky.',
    radiusKm: 1250, g: 0.12, landable: true, atmosphere: null,
    orbit: { parent: 'lethe', equatorOf: 'lethe', r: km(140000), period: 6.6 * 3600, phase: 140 },   // 140,000 km, 6.6 h, in Lethe's equatorial plane
    frame: { type: 'locked', to: 'lethe' },
    standoffR: 3.0, capR: 0.35, approachM: 25,
    look: { albedo: 0.42, color: [0.52, 0.54, 0.58], seed: 5.3, parentShine: [0.45, 0.50, 0.85] },
    lines: { approach: 'world.charon.approach', arrive: 'world.charon.arrive', scan: 'world.charon.scan', mc: 'world.charon.mc', land: 'world.charon.land', surface: 'world.charon.surface', takeoff: 'world.charon.takeoff' },
    codex: 'world.charon',
    sites: [
      { id: 'sentinel', name: 'Sentinel Observatory', lat: 8, lon: 70, desc: 'The telescope that watches EURYDICE’s frozen image on the horizon.' },
      { id: 'ferryman', name: 'Ferryman’s Crater', lat: -35, lon: -40, desc: 'Ice spires in a shadowed crater.' },
    ],
  },
  {
    id: 'cocytus', name: 'Cocytus', label: 'COCYTUS', kind: 'planet', group: 'WORLDS', sheet: 1,
    desc: 'Frozen world, −190 °C. Blue ice plains, crevasses, howling cryo-geysers; dim twilight.',
    radiusKm: 4700, g: 0.9, landable: true,
    atmosphere: { pressure: 0.15, color: [0.55, 0.75, 1.0], density: 0.75, haze: 0.55, height: 0.026, desc: 'Thin N₂ haze, 0.15 atm' },
    orbit: { parent: null, r: 420, inc: 14, node: 100, phase: -170 },
    frame: { type: 'locked', to: 'erebus' },
    standoffR: 3.0, capR: 0.35, approachM: 25,
    look: { albedo: 0.72, color: [0.55, 0.70, 0.85], seed: 11.2 },
    lines: { approach: 'world.cocytus.approach', arrive: 'world.cocytus.arrive', scan: 'world.cocytus.scan', mc: 'world.cocytus.mc', land: 'world.cocytus.land', surface: 'world.cocytus.surface', takeoff: 'world.cocytus.takeoff' },
    codex: 'world.cocytus',
    sites: [
      { id: 'wailing', name: 'Wailing Field', lat: 30, lon: 80, desc: 'Geyser field and a monitor station.' },
      { id: 'lake', name: 'The Frozen Lake', lat: -18, lon: 68, desc: 'EURYDICE memorial built by the Halcyon crew.' },
    ],
  },
  {
    id: 'eurydice', name: 'EURYDICE', label: 'EURYDICE', kind: 'ship', group: 'ANTIVERSE', sheet: -1,
    desc: 'The lost sister ship, HX-01. Derelict, drifting in the negative-mass universe.',
    radiusKm: 0.024, g: 1.0, landable: false, atmosphere: null,
    fixed: { pos: [14, -9, -30], vel: [2.0e-6, -1.0e-6, -4.0e-6] },       // r ≈ −34
    frame: { type: 'fixed', forward: [0.62, 0.05, 0.78], up: [0, 1, 0] },
    standoffKm: 0.15, capKm: 0.02, approachGapKm: 0.12, approachM: 25, meshRangeKm: 25,
    dockable: true, port: { pos: [-4.6, -0.2, 14], normal: [-1, 0, 0], up: [0, 1, 0] },
    look: { albedo: 0.5, color: [0.7, 0.72, 0.75], beacon: [1.0, 0.18, 0.12] },
    lines: { approach: 'eurydice.approach', approachCmdr: 'cmdr.eurydice', arrive: 'eurydice.arrive', dock: 'eurydice.dock', enter: 'eurydice.enter', cmdrDock: 'cmdr.dock.request', cmdrUndock: 'cmdr.undock' },
    codex: 'world.eurydice', sites: [],
  },
  {
    id: 'elysium', name: 'Elysium', label: 'ELYSIUM', kind: 'planet', group: 'ANTIVERSE', sheet: -1,
    desc: 'Rogue world of the negative-mass universe. Dark glass crust veined with phosphorescent crystal.',
    radiusKm: 3300, g: 0.4, landable: true,
    atmosphere: { pressure: 0.04, color: [0.45, 0.60, 1.0], density: 0.45, haze: 0.12, height: 0.008, desc: 'Thin cold air, 0.04 atm' },
    fixed: { pos: [-55, 70, -95], vel: [-0.8e-4, 1.0e-4, -1.4e-4] },      // r ≈ −130, creeping outward (~40 km/s)
    frame: { type: 'galaxy', tilt: 18, azimuth: 120 },
    standoffR: 3.0, capR: 0.35, approachM: 25,
    look: { albedo: 0.05, color: [0.03, 0.04, 0.07], seed: 17.4, glow: [0.15, 0.85, 1.0], glow2: [0.62, 0.30, 1.0] },
    lines: { approach: 'world.elysium.approach', arrive: 'world.elysium.arrive', scan: 'world.elysium.scan', mc: null, echo: 'world.elysium.echo', land: 'world.elysium.land', surface: 'world.elysium.surface', takeoff: 'world.elysium.takeoff' },
    codex: 'world.elysium',
    sites: [
      { id: 'camp', name: 'Eurydice Camp', lat: 12, lon: 32, desc: 'Elena and Tomas’s camp and their lander LANTERN.' },
      { id: 'garden', name: 'Glass Garden', lat: -25, lon: -48, desc: 'A crystal forest and Tomas’s sensor array.' },
    ],
  },
];

for (const b of BODIES) {
  b.radius = km(b.radiusKm);                                              // M
  b.standoff = b.standoffKm !== undefined ? km(b.standoffKm) : b.radius * b.standoffR;   // M, centre distance
  b.cap = b.capKm !== undefined ? km(b.capKm) : b.radius * (b.capR ?? 0.35);
  if (b.approachGapKm !== undefined) b.approachGap = km(b.approachGapKm);
  if (b.orbit) b.orbit.period = b.orbit.period ?? null;
  b.meshRangeKm = b.meshRangeKm ?? 0;
  b.sites = b.sites || [];
  for (const s of b.sites) s.id = String(s.id);
}

export const bodies = BODIES;
export const byId = Object.fromEntries(BODIES.map((b) => [b.id, b]));
export const GROUPS = ['STATIONS', 'WORLDS', 'ANTIVERSE'];
export default { bodies, byId, LIGHT, KM_PER_M, GROUPS };
