// ORPHEUS / EURYDICE — layout constants (single source of truth for every part builder).
// Ship space, metres. Origin = seated pilot eye. +X starboard, +Y up, −Z forward (nose).
// Port = −X, starboard = +X. Aft = +Z.

export const FLOOR = -1.2;      // main-deck walking surface
export const CEIL = 1.35;       // main-deck ceiling (underside of the slab)
export const DECK2 = 1.4;       // dome-deck walking surface
export const EYE_H = 1.66;      // standing eye above floor
export const WALL_T = 0.15;     // interior partition thickness

// Lining (inner wall surface) half-widths and skin (outer hull) half-widths per hull module
export const HAB_IN = 4.0, HAB_SKIN = 4.4;        // habitat z 2.4..24
export const AFT_IN = 3.6, AFT_SKIN = 4.0;        // cargo + engineering z 24..38
export const ROOF_Y = 1.6, KEEL_Y = -1.5;         // outer skin top / bottom (flat belly)
export const CORRIDOR_HW = 1.1;                   // corridor half-width (corridor-side wall surface)
export const ROOM_IN_X = CORRIDOR_HW + WALL_T;    // 1.25: room-side surface of the corridor walls

// Hull modules along Z (stacked): nose → command (flight deck) → habitat → cargo → engineering → drive
export const MODULES = {
  nose:        { z0: -3.4, z1: -1.0 },
  command:     { z0: -1.0, z1: 2.4 },
  habitat:     { z0: 2.4,  z1: 24.0, skin: HAB_SKIN, inner: HAB_IN },
  cargo:       { z0: 24.0, z1: 31.0, skin: AFT_SKIN, inner: AFT_IN },
  engineering: { z0: 31.0, z1: 38.0, skin: AFT_SKIN, inner: AFT_IN },
  drive:       { z0: 38.0, z1: 44.6 },
};
export const SHIP_Z0 = -3.4, SHIP_Z1 = 44.6;      // nose tip … nozzle exit (≈ 48 m)

// Skin half-width of the main prismatic hull at z (for placing things on the flanks)
export function skinX(z) { return z < 24 ? HAB_SKIN : AFT_SKIN; }
export function innerX(z) { return z < 24 ? HAB_IN : AFT_IN; }

// Published rooms (WalkSpace.rooms). min/max = [x,y,z]
export const ROOMS = [
  { id: 'flightdeck',  name: 'Flight Deck',   min: [-3.0, FLOOR, -1.0], max: [3.0, CEIL, 2.4] },
  { id: 'corridor',    name: 'Spine Corridor',min: [-CORRIDOR_HW, FLOOR, 2.4], max: [CORRIDOR_HW, CEIL, 24.0] },
  { id: 'quarters',    name: 'Crew Quarters', min: [-HAB_IN, FLOOR, 3.0], max: [-ROOM_IN_X, CEIL, 8.0] },
  { id: 'galley',      name: 'Galley',        min: [-HAB_IN, FLOOR, 8.0], max: [-ROOM_IN_X, CEIL, 14.0] },
  { id: 'airlock',     name: 'Airlock',       min: [-HAB_IN, FLOOR, 14.0], max: [-ROOM_IN_X, CEIL, 18.0] },
  { id: 'lab',         name: 'Science Lab',   min: [ROOM_IN_X, FLOOR, 3.0], max: [HAB_IN, CEIL, 10.0] },
  { id: 'medbay',      name: 'Medbay',        min: [ROOM_IN_X, FLOOR, 10.0], max: [HAB_IN, CEIL, 14.0] },
  { id: 'core',        name: 'LYRA Core',     min: [ROOM_IN_X, FLOOR, 14.0], max: [HAB_IN, CEIL, 18.0] },
  { id: 'dome',        name: 'Observation Dome', min: [-2.6, DECK2, 7.4], max: [2.6, 4.4, 12.6] },
  { id: 'cargo',       name: 'Cargo Bay',     min: [-AFT_IN, FLOOR, 24.0], max: [AFT_IN, CEIL, 31.0] },
  { id: 'engineering', name: 'Engineering',   min: [-AFT_IN, FLOOR, 31.0], max: [AFT_IN, CEIL, 38.0] },
];
export const ROOM = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

// Flight deck plan: narrow pod (canopy) flaring to the corridor bulkhead.
export const FLIGHTDECK = {
  podHW: 1.25, podZ0: -1.0, podZ1: 0.35,          // pod half-width and z range (pilot seat at origin)
  bayHW: 3.0, flareZ1: 1.9, aftZ: 2.4,            // bay flares (diagonal walls) from (±podHW, podZ1) to (±bayHW, flareZ1), then straight to aftZ
  ceilFront: 0.86, ceilBack: 1.35,                 // ceiling height at z = podZ1 and at aftZ (sloped)
};
export function flightdeckCeil(z) {               // sloped ceiling y at z (flight deck)
  const t = Math.min(Math.max((z - FLIGHTDECK.podZ1) / (FLIGHTDECK.aftZ - FLIGHTDECK.podZ1), 0), 1);
  return FLIGHTDECK.ceilFront + (FLIGHTDECK.ceilBack - FLIGHTDECK.ceilFront) * t;
}
// half-width of the flight deck interior at z (diagonal flare)
export function flightdeckHW(z) {
  const F = FLIGHTDECK;
  if (z <= F.podZ1) return F.podHW;
  if (z >= F.flareZ1) return F.bayHW;
  return F.podHW + (F.bayHW - F.podHW) * (z - F.podZ1) / (F.flareZ1 - F.podZ1);
}

// Doors (corridor side). axis 'x' = door lies in a wall whose normal is X (leaf slides along Z); 'z' = bulkhead normal Z (leaf slides along X).
// (x, z) is the centre of the wall plane at the opening. width/height of the clear opening.
export const DOORS = [
  { id: 'flightdeck', rooms: ['flightdeck', 'corridor'], axis: 'z', x: 0,     z: 2.4,  width: 1.5, h: 2.2, leaves: 2 },
  { id: 'quarters',   rooms: ['corridor', 'quarters'],   axis: 'x', x: -1.175, z: 4.6, width: 1.0, h: 2.15, leaves: 1 },
  { id: 'galley',     rooms: ['corridor', 'galley'],     axis: 'x', x: -1.175, z: 10.2, width: 1.0, h: 2.15, leaves: 1 },
  { id: 'airlock',    rooms: ['corridor', 'airlock'],    axis: 'x', x: -1.175, z: 16.0, width: 1.0, h: 2.15, leaves: 1 },
  { id: 'lab',        rooms: ['corridor', 'lab'],        axis: 'x', x: 1.175,  z: 4.6, width: 1.0, h: 2.15, leaves: 1 },
  { id: 'medbay',     rooms: ['corridor', 'medbay'],     axis: 'x', x: 1.175,  z: 13.4, width: 1.0, h: 2.15, leaves: 1 },
  { id: 'core',       rooms: ['corridor', 'core'],       axis: 'x', x: 1.175,  z: 16.0, width: 1.0, h: 2.15, leaves: 1 },
  { id: 'cargo',      rooms: ['corridor', 'cargo'],      axis: 'z', x: 0,     z: 24.0, width: 1.6, h: 2.2, leaves: 2 },
  { id: 'engineering',rooms: ['cargo', 'engineering'],   axis: 'z', x: 2.4,   z: 31.0, width: 1.1, h: 2.15, leaves: 1 },
];
export const DOOR = Object.fromEntries(DOORS.map((d) => [d.id, d]));

// Windows through the OUTER wall (lining at ±innerX, skin at ±skinX). The hull skin gets a matching cut.
// kind 'round' (r) or 'rect' (w×h, rounded corner rc). side −1 port / +1 starboard. y = centre height.
export const WINDOWS = [
  { id: 'quarters.porthole', room: 'quarters', side: -1, z: 5.6,  y: 0.25, kind: 'round', r: 0.34 },
  { id: 'galley.window',     room: 'galley',   side: -1, z: 11.0, y: 0.25, kind: 'rect', w: 1.5, h: 0.85, rc: 0.12 },
  { id: 'lab.porthole.1',    room: 'lab',      side: 1,  z: 5.6,  y: 0.25, kind: 'round', r: 0.30 },
  { id: 'lab.porthole.2',    room: 'lab',      side: 1,  z: 8.4,  y: 0.25, kind: 'round', r: 0.30 },
  { id: 'medbay.porthole',   room: 'medbay',   side: 1,  z: 12.0, y: 0.25, kind: 'round', r: 0.30 },
  { id: 'cargo.porthole',    room: 'cargo',    side: 1,  z: 28.0, y: 0.35, kind: 'round', r: 0.30 },
  { id: 'cargo.porthole.p',  room: 'cargo',    side: -1, z: 28.0, y: 0.35, kind: 'round', r: 0.30 },
];

// Airlock outer hatch (port flank). Plane of the skin; the hatch tunnel runs from the lining (x=−HAB_IN) to the skin (x=−HAB_SKIN).
export const HATCH = { z: 16.0, y0: FLOOR, y1: 0.85, hw: 0.6, side: -1 };

// Stairs to the dome deck (starboard side of corridor, climbing FORWARD): foot at zFoot (floor), top at zTop (deck 2 level).
export const STAIR = { x0: 0.15, x1: 1.1, zFoot: 12.3, zTop: 7.9, yFoot: FLOOR, yTop: DECK2,
  holeZ0: 7.9, holeZ1: 11.4 };                     // opening in the dome-deck slab / main ceiling (x0..x1 × holeZ0..holeZ1)
// Observation dome (glass hemisphere on a short collar)
export const DOME = { cx: 0, cz: 10.0, r: 2.6, deckY: DECK2, collarY: 1.75 };

// Ventral cargo ramp (lane in the cargo floor, hinged at the forward end, lowers AFT/down)
export const RAMP = { x0: -1.3, x1: 1.3, zTop: 25.2, length: 7.2, thick: 0.25, yTop: FLOOR, groundY: -4.2 };
RAMP.angle = Math.asin((RAMP.yTop - RAMP.groundY) / RAMP.length);                 // ≈ 24.6°
RAMP.zFoot = RAMP.zTop + RAMP.length * Math.cos(RAMP.angle);                      // ≈ 31.74
RAMP.zClosedEnd = RAMP.zTop + RAMP.length;                                         // closed: lane/belly plate z 25.2..32.4
export const GROUND_Y = RAMP.groundY;                                             // ship-space y of the ground when landed

// Legs: hinge points (hull) and foot pad centres when deployed (feet at GROUND_Y)
export const LEGS = [
  { id: 'fp', side: -1, hinge: [-3.7, -1.35, 4.6], foot: [-5.2, GROUND_Y, 4.2] },
  { id: 'fs', side: 1,  hinge: [3.7, -1.35, 4.6],  foot: [5.2, GROUND_Y, 4.2] },
  { id: 'ap', side: -1, hinge: [-3.4, -1.35, 33.5], foot: [-5.0, GROUND_Y, 33.9] },
  { id: 'as', side: 1,  hinge: [3.4, -1.35, 33.5],  foot: [5.0, GROUND_Y, 33.9] },
];

// Seats
export const SEATS = {
  pilot:   { eye: [0, 0, 0],       stand: [-0.55, FLOOR, 0.8], yaw: 0 },
  systems: { eye: [1.4, 0, 1.15],  stand: [1.4, FLOOR, 2.0], yaw: 0 },
};

// Airlock / docking
export const AIRLOCK = {
  inner: [-CORRIDOR_HW, FLOOR, 16.0],
  outer: [-HAB_SKIN + 0.2, FLOOR, 16.0],
  evaExit: [-5.7, -0.2, 16.0],
  dock: { pos: [-4.71, -0.175, 16.0], normal: [-1, 0, 0] },   // outer face of the docking collar (gear_collar.js)
};

// Default interior light sites (pool of ≤6 real PointLights follows the viewer). k = relative intensity.
export const LIGHT_SITES = [
  { id: 'flightdeck', pos: [0, 0.7, 0.9],    color: 0xcfe6ff, k: 1.0 },
  { id: 'fd.rear',    pos: [0, 0.9, 2.0],    color: 0xcfe6ff, k: 0.6 },
  { id: 'corr.a',     pos: [0, 1.1, 5.0],    color: 0xe8f0ff, k: 1.0 },
  { id: 'corr.b',     pos: [0, 1.1, 11.0],   color: 0xe8f0ff, k: 1.0 },
  { id: 'corr.c',     pos: [0, 1.1, 18.0],   color: 0xe8f0ff, k: 1.0 },
  { id: 'corr.d',     pos: [0, 1.1, 22.0],   color: 0xe8f0ff, k: 0.8 },
  { id: 'quarters',   pos: [-2.6, 1.0, 5.5], color: 0xffe2c4, k: 1.0 },
  { id: 'galley',     pos: [-2.6, 1.0, 11.0],color: 0xffe6cc, k: 1.0 },
  { id: 'airlock',    pos: [-2.6, 1.0, 16.0],color: 0xf0f6ff, k: 1.0 },
  { id: 'lab',        pos: [2.6, 1.0, 6.5],  color: 0xe4f2ff, k: 1.0 },
  { id: 'medbay',     pos: [2.6, 1.0, 12.0], color: 0xe6fff4, k: 1.0 },
  { id: 'core',       pos: [2.6, 0.4, 16.0], color: 0x66ddff, k: 1.1 },
  { id: 'dome',       pos: [0, 3.2, 10.0],   color: 0xb8d8ff, k: 0.8 },
  { id: 'cargo',      pos: [0, 1.0, 27.5],   color: 0xfff2dc, k: 1.1 },
  { id: 'engineering',pos: [0, 0.8, 34.5],   color: 0xffb070, k: 1.2 },
];

export function roomAt(x, y, z) {
  for (let i = ROOMS.length - 1; i >= 0; i--) {   // later entries (dome) win on overlap; corridor listed early
    const r = ROOMS[i];
    if (x >= r.min[0] && x <= r.max[0] && y >= r.min[1] - 0.2 && y <= r.max[1] && z >= r.min[2] && z <= r.max[2]) return r.id;
  }
  return null;
}

// Drive: engineering's aft bulkhead (z=38) has a viewport onto the reaction chamber (z 38..41, built by engineering.js);
// the torch nozzle (throat at z=41 → bell exit at z=44.6) is built by drive.js. Axis of thrust: x=0, y=DRIVE.axisY.
export const DRIVE = { axisY: 0.15, chamberZ0: 38.0, chamberZ1: 41.0, chamberR: 1.25, throatZ: 41.0, throatR: 0.7, bellZ1: 44.6, bellR1: 2.7 };
export const ENG_WINDOW = { x0: -1.5, x1: 1.5, y0: -0.75, y1: 0.85, z: 38.0 };
// Cargo ramp lane in the cargo floor (hinged at forward edge z=RAMP.zTop). Cargo-bay side catwalks are fixed deck.
export const CARGO_DOOR = { x: 0, z: 24.0, w: 1.6 };

// Exterior skin profiles (stations for builder.loftGeometry: z, half-width w, top y, bottom y, corner radius rc). Shared by hull/drive/gear/fixtures.
// NOSE: tip → command module. Top profile stays below the pilot's sightline over the dash (y < −0.449·|z|).
export const NOSE_STATIONS = [
  { z: -3.4, w: 0.20, top: -1.46, bot: -1.74, rc: 0.10 }, { z: -2.9, w: 0.55, top: -1.28, bot: -1.72, rc: 0.20 }, { z: -2.2, w: 0.95, top: -1.00, bot: -1.65, rc: 0.30 },
  { z: -1.6, w: 1.25, top: -0.78, bot: -1.58, rc: 0.35 }, { z: -1.0, w: 1.45, top: -0.50, bot: -1.50, rc: 0.40 },
];
// MAIN FUSELAGE: habitat (2.4..22.6, 4.4 wide) → taper → cargo/engineering (24.6..36.6, 4.0 wide) → tail taper to the drive mount at z=41.
export const HULL_STATIONS = [
  { z: 2.4, w: 4.4, top: 1.6, bot: -1.5, rc: 0.95 }, { z: 22.6, w: 4.4, top: 1.6, bot: -1.5, rc: 0.95 }, { z: 24.6, w: 4.0, top: 1.6, bot: -1.5, rc: 0.9 },
  { z: 36.6, w: 4.0, top: 1.6, bot: -1.5, rc: 0.9 }, { z: 38.4, w: 3.1, top: 1.52, bot: -1.42, rc: 1.1 }, { z: 40.0, w: 2.4, top: 1.3, bot: -1.05, rc: 1.15 },
  { z: 41.0, w: 2.1, top: 1.2, bot: -0.9, rc: 1.1 },
];
// Command-module (flight deck) skin section at z=2.4; a shoulder ring plate joins it to HULL_STATIONS[0].
export const COMMAND_REAR = { w: 3.3, top: 1.58, bot: -1.5, rc: 0.5 };
