// ORPHEUS · surface worlds · site table.
// Pure data (+ tiny closed-form helpers). Consumed by surface.js, terrain.js, biomes.js, POI builders, FX and ambience.
//
// Frame: SHIP SPACE (metres). Origin = pilot eye of the landed ship, +X starboard/east, +Y up, −Z = ship forward = local north.
// The ship lies along +Z from its nose (z ≈ −9) to the drive nozzle (z ≈ +46); the ground pad is centred under the hull.
// Bearings: 0° = −Z (ahead / north), 90° = +X (starboard / east), 180° = +Z (aft), 270° = −X (port / west).

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

/** [x, z] of a point `dist` metres from the pilot eye on compass `bearingDeg` (0 = ahead, 90 = starboard). */
export const bearingXZ = (dist, bearingDeg) => { const b = bearingDeg * DEG; return [dist * Math.sin(b), -dist * Math.cos(b)]; };

/** rotation.y that makes an object's local +Z face the pilot eye from (x, z). */
export const facingYaw = (x, z) => Math.atan2(-x, -z);

/** unit vector (ship space) for sun/light azimuth+elevation in degrees (az 0 = ahead, 90 = starboard). */
export function dirFromAzEl(azDeg, elDeg, out = [0, 0, 0]) {
  const a = azDeg * DEG, e = elDeg * DEG, ce = Math.cos(e);
  out[0] = Math.sin(a) * ce; out[1] = Math.sin(e); out[2] = -Math.cos(a) * ce; return out;
}

function slot(dist, bearing, padR, extra = {}) {
  const [x, z] = bearingXZ(dist, bearing);
  return { x, z, yaw: facingYaw(x, z), padR, dist, bearing, ...extra };
}

/** closed-form lava river centre-line x(z) (+ slope) — mirrored 1:1 in GLSL (biomes.js). Flow is toward +Z. */
export function makeRiver(p) {
  const cx = (z) => p.x0 + p.a1 * Math.sin(TAU * z / p.l1 + p.p1) + p.a2 * Math.sin(TAU * z / p.l2 + p.p2);
  const dcx = (z) => p.a1 * TAU / p.l1 * Math.cos(TAU * z / p.l1 + p.p1) + p.a2 * TAU / p.l2 * Math.cos(TAU * z / p.l2 + p.p2);
  return {
    ...p, wChannel: p.wLava * p.chan, cx, dcx,
    /** signed lateral distance (m) from the lava centre-line (+ = east of it) */
    dist: (x, z) => (x - cx(z)) / Math.sqrt(1 + dcx(z) * dcx(z)),
    /** unit flow direction [dx, dz] at z (toward +Z) */
    flow: (z) => { const s = dcx(z), n = Math.hypot(s, 1); return [s / n, 1 / n]; },
  };
}

// ───────────────────────────── fallback body data (shape mirrors src/world/catalog.js; catalog wins when present) ─────────────────────────────
export const BODY_FALLBACK = {
  asphodel:   { id: 'asphodel',   name: 'Asphodel',   radiusKm: 5400, g: 0.86, atmosphere: { pressure: 0.8, color: [0.36, 0.56, 1.0], density: 1.0, haze: 0.25 } },
  phlegethon: { id: 'phlegethon', name: 'Phlegethon', radiusKm: 4100, g: 1.2,  atmosphere: { pressure: 1.6, color: [1.0, 0.66, 0.30], density: 1.5, haze: 0.85 } },
  charon:     { id: 'charon',     name: 'Charon',     radiusKm: 1250, g: 0.12, atmosphere: null },
  cocytus:    { id: 'cocytus',    name: 'Cocytus',    radiusKm: 4700, g: 0.9,  atmosphere: { pressure: 1.3, color: [0.55, 0.70, 0.95], density: 1.2, haze: 0.7 } },
  elysium:    { id: 'elysium',    name: 'Elysium',    radiusKm: 3300, g: 0.4,  atmosphere: { pressure: 0.12, color: [0.50, 0.62, 1.0], density: 0.25, haze: 0.3 } },
};

// ───────────────────────────── sites ─────────────────────────────
// terrain: plain numbers consumed by biomes.js (see the P-layout comment there). look: fallback light direction (deg) when the core gives none.
// slots: POI placements (flat pad radius padR; builders must keep props inside it). geysers: cocytus/wailing vents.
const RIVER_RIDGE = makeRiver({ x0: 58.8, a1: 34, l1: 330, p1: 1.3, a2: 6, l2: 97, p2: 0.4, wLava: 4.6, chan: 2.7, carve: 4.2 });
const RIVER_FORGE = makeRiver({ x0: -96, a1: 38, l1: 280, p1: 0.2, a2: 8, l2: 83, p2: 2.0, wLava: 3.4, chan: 2.8, carve: 3.4 });

export const SITES = {
  asphodel: {
    meadow: {
      id: 'meadow', name: 'Meadow Base', biome: 'asphodel', seed: 11,
      look: { elev: 36, az: -35 },
      slots: { outpost: slot(125, 345, 17, { what: 'survey outpost hab + recorder' }), mast: slot(172, 40, 6.5, { what: 'weather mast' }) },
      terrain: { seaOn: 0, hillAmp: 17, hillWave: 460, cliffH: 5.5, cliffWave: 430, coast: null },
      wind: 0.45,
    },
    shore: {
      id: 'shore', name: 'Grey Shore', biome: 'asphodel', seed: 23,
      look: { elev: 20, az: -75 },
      slots: { drone: slot(80, 300, 9, { what: 'crashed drone + recorder' }), pools: slot(150, 335, 11, { what: 'tide pools' }) },
      terrain: { seaOn: 1, hillAmp: 13, hillWave: 430, cliffH: 6.5, cliffWave: 380, coast: { bearing: 285, d: 108, wob: 14, wobWave: 170 }, islandAmp: 13, islandWave: 900 },
      wind: 0.6,
    },
  },
  phlegethon: {
    ridge: {
      id: 'ridge', name: 'Cinder Ridge', biome: 'phlegethon', seed: 31,
      look: { elev: 27, az: 25 },
      slots: { seismic: slot(110, 20, 0, { what: 'seismic station over the lava river', river: true }) },
      terrain: { flowAmp: 5, flowWave: 240, ridgeAmp: 70, ridgeBearing: 330, ridgeDist: 520, coneAmp: 1, fissure: 0.35, river: RIVER_RIDGE },
      wind: 0.35,
    },
    forge: {
      id: 'forge', name: 'The Forge', biome: 'phlegethon', seed: 37,
      look: { elev: 2.5, az: -20 },
      slots: { lander: slot(115, 330, 14, { what: 'abandoned lander + recorder' }) },
      lookOverride: { hemiFloor: 0.9, hemiI: 1.1 },
      terrain: { flowAmp: 3.5, flowWave: 200, ridgeAmp: 25, ridgeBearing: 60, ridgeDist: 650, coneAmp: 0.6, fissure: 1.0, river: RIVER_FORGE },
      wind: 0.3,
    },
  },
  charon: {
    sentinel: {
      id: 'sentinel', name: 'Sentinel Observatory', biome: 'charon', seed: 41,
      look: { elev: 14, az: 50 },
      slots: { telescope: slot(160, 15, 24, { what: 'telescope dome, ghost screen, recorder' }) },
      terrain: { hillAmp: 7, hillWave: 480, craterDensity: 1.0, big: null },
      wind: 0,
    },
    ferryman: {
      id: 'ferryman', name: "Ferryman's Crater", biome: 'charon', seed: 47,
      look: { elev: 32, az: -40 },
      slots: { marker: slot(90, 350, 4.5, { what: 'survey marker + recorder' }) },
      terrain: { hillAmp: 3, hillWave: 420, craterDensity: 0.55, big: { cx: 0, cz: -215, R: 720, depth: 150, rim: 38 } },
      spires: { cx: -30, cz: -215, r: 170, count: 150 },
      wind: 0,
    },
  },
  cocytus: {
    wailing: {
      id: 'wailing', name: 'Wailing Field', biome: 'cocytus', seed: 53,
      look: { elev: 16, az: 30 },
      slots: { geyser: slot(85, 335, 12, { what: 'geyser monitor station + recorder' }) },
      terrain: { plainAmp: 9, plainWave: 300, lake: null, crevAmp: 7, crevWave: 130, drift: 1.0 },
      vents: [slot(150, 20, 0), slot(215, 355, 0), slot(265, 55, 0), slot(190, 295, 0), slot(340, 335, 0), slot(410, 15, 0), slot(130, 190, 0), slot(300, 250, 0)],
      wind: 1.0,
    },
    lake: {
      id: 'lake', name: 'The Frozen Lake', biome: 'cocytus', seed: 59,
      look: { elev: 17, az: -15 },
      slots: { memorial: slot(110, 0, 10, { what: 'EURYDICE memorial obelisk + recorder' }) },
      terrain: { plainAmp: 9, plainWave: 380, lake: { cx: 0, cz: -330, R: 320, edge: 80 }, crevAmp: 3, crevWave: 150, drift: 0.5 },
      vents: [slot(520, 40, 0)],
      wind: 0.55,
    },
  },
  elysium: {
    camp: {
      id: 'camp', name: 'Eurydice Camp', biome: 'elysium', seed: 61,
      look: { elev: 50, az: -20 },
      slots: { camp: slot(85, 350, 16, { what: "Elena & Tomas's camp, recorders" }), lantern: slot(125, 25, 12, { what: 'lander LANTERN' }) },
      terrain: { duneAmp: 6, duneWave: 400, crystalDensity: 0.25 },
      wind: 0.1,
    },
    garden: {
      id: 'garden', name: 'Glass Garden', biome: 'elysium', seed: 67,
      look: { elev: 50, az: 30 },
      slots: { sensor: slot(100, 10, 12, { what: "Tomas's sensor array + recorder" }), monolith: slot(62, 320, 9, { what: 'great crystal cluster (crystal forest centrepiece)' }) },
      terrain: { duneAmp: 9, duneWave: 340, crystalDensity: 1.0 },
      wind: 0.1,
    },
  },
};

/** per-world lighting presets (absolute radiance units; exposure is applied only to the ray-traced background) */
export const LOOKS = {
  asphodel:   { sunCol: [1.0, 0.86, 0.70], sunI: 3.4, hemiSky: [0.55, 0.72, 1.0], hemiGround: [0.22, 0.24, 0.20], hemiI: 0.9, hemiFloor: 0.10 },
  phlegethon: { sunCol: [1.0, 0.62, 0.38], sunI: 3.0, hemiSky: [0.85, 0.50, 0.28], hemiGround: [0.20, 0.08, 0.04], hemiI: 0.7, hemiFloor: 0.22 },
  charon:     { sunCol: [1.0, 0.88, 0.72], sunI: 2.5, hemiSky: [0.30, 0.34, 0.62], hemiGround: [0.10, 0.10, 0.12], hemiI: 0.28, hemiFloor: 0.10 },
  cocytus:    { sunCol: [1.0, 0.82, 0.66], sunI: 1.1, hemiSky: [0.52, 0.66, 0.95], hemiGround: [0.30, 0.38, 0.50], hemiI: 0.9, hemiFloor: 0.55 },
  elysium:    { sunCol: [0.66, 0.80, 1.0], sunI: 0.9, hemiSky: [0.40, 0.55, 1.0], hemiGround: [0.14, 0.08, 0.26], hemiI: 0.55, hemiFloor: 0.5 },
};

/** Lookup helper: returns the site definition or throws a readable error. */
export function getSiteDef(bodyId, siteId) {
  const b = SITES[bodyId];
  if (!b) throw new Error(`surface: unknown body '${bodyId}'`);
  const s = b[siteId] || b[Object.keys(b)[0]];
  if (!s) throw new Error(`surface: unknown site '${bodyId}/${siteId}'`);
  return s;
}
