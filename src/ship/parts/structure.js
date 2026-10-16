// Interior shell: floors, ceilings, partition/outer walls with openings, sliding doors, window reveals, corridor fittings,
// ceiling light panels, accent strips, door signs, hull skin cuts for windows/hatch/dome. Room props live in other parts.
import * as THREE from 'three';
import { extrudePoly } from './builder.js';

const V3 = THREE.Vector3;

export default function build(kit) {
  const L = kit.L, { FLOOR, CEIL } = L, T = L.WALL_T, eur = kit.eur;
  const yMid = (FLOOR + CEIL) / 2, H = CEIL - FLOOR;

  // ───────── generic wall with rectangular openings ─────────
  // axis 'x': wall plane x = at running along z (a0..a1). axis 'z': plane z = at running along x. holes: [{c0,c1,y0,y1}] in the running coordinate.
  // returns the list of full-height solid ranges [[c0,c1],…] (for fittings).
  function wall(axis, at, a0, a1, o = {}) {
    const { t = T, y0 = FLOOR, y1 = CEIL, holes = [], mat = 'wall', col = true, skirt = true } = o;
    const solids = [];
    const piece = (c0, c1, ya, yb, collide) => {
      const len = c1 - c0, h = yb - ya; if (len < 1e-3 || h < 1e-3) return;
      const mid = (c0 + c1) / 2, ym = (ya + yb) / 2;
      if (axis === 'x') kit.box(mat, [at, ym, mid], [t, h, len], { bev: 0.008, col: collide });
      else kit.box(mat, [mid, ym, at], [len, h, t], { bev: 0.008, col: collide });
    };
    const base = (c0, c1) => {
      if (!skirt) return; const len = c1 - c0; if (len < 0.05) return; const mid = (c0 + c1) / 2;
      for (const sd of [-1, 1]) {
        if (axis === 'x') kit.box('trim', [at + sd * (t / 2 + 0.012), y0 + 0.06, mid], [0.024, 0.12, len], { bev: 0.004 });
        else kit.box('trim', [mid, y0 + 0.06, at + sd * (t / 2 + 0.012)], [len, 0.12, 0.024], { bev: 0.004 });
      }
    };
    const hs = holes.slice().sort((p, q) => p.c0 - q.c0);
    let cur = a0;
    for (const h of hs) {
      if (h.c0 > cur + 1e-3) { piece(cur, h.c0, y0, y1, col); base(cur, h.c0); solids.push([cur, h.c0]); }
      if (h.y0 > y0 + 1e-3) piece(h.c0, h.c1, y0, h.y0, col);
      if (h.y1 < y1 - 1e-3) piece(h.c0, h.c1, h.y1, y1, false);
      cur = h.c1;
    }
    if (a1 > cur + 1e-3) { piece(cur, a1, y0, y1, col); base(cur, a1); solids.push([cur, a1]); }
    return solids;
  }
  const doorHole = (d) => ({ c0: (d.axis === 'x' ? d.z : d.x) - d.width / 2, c1: (d.axis === 'x' ? d.z : d.x) + d.width / 2, y0: FLOOR, y1: FLOOR + d.h });
  const D = L.DOOR;

  // ───────── floors (base slabs + walkable floor registration) ─────────
  const slab = (mat, x0, x1, z0, z1, ytop, th = 0.12) => kit.box(mat, [(x0 + x1) / 2, ytop - th / 2, (z0 + z1) / 2], [x1 - x0, th, z1 - z0], { bev: 0.004 });
  slab('floor', -1.25, 1.25, -1.0, 0.35, FLOOR);                 // flight deck pod
  slab('floor', -3.0, 3.0, 0.35, 2.4, FLOOR);                    // flight deck bay
  slab('floor', -L.HAB_IN, L.HAB_IN, 2.4, 24.0, FLOOR);          // habitat: corridor + all side rooms
  slab('floor', -L.AFT_IN, -1.3, 24.0, 31.0, FLOOR); slab('floor', 1.3, L.AFT_IN, 24.0, 31.0, FLOOR);   // cargo side catwalks
  slab('floor', -1.3, 1.3, 24.0, L.RAMP.zTop, FLOOR);            // cargo: forward of the ramp lane
  kit.floor(-1.25, -1.0, 1.25, 0.35, FLOOR); kit.floor(-3.0, 0.35, 3.0, 2.4, FLOOR); kit.floor(-L.HAB_IN, 2.4, L.HAB_IN, 24.0, FLOOR);
  kit.floor(-L.AFT_IN, 24.0, -1.3, 31.0, FLOOR); kit.floor(1.3, 24.0, L.AFT_IN, 31.0, FLOOR); kit.floor(-1.3, 24.0, 1.3, L.RAMP.zTop, FLOOR);
  // engineering: grated catwalk over a lower machinery deck
  kit.floor(-L.AFT_IN, 31.0, L.AFT_IN, 38.0, FLOOR, FLOOR, null, { step: 'grate' });
  slab('floor', -L.AFT_IN, L.AFT_IN, 31.0, 38.0, FLOOR - 0.2, 0.1);
  kit.box('grate', [0, FLOOR - 0.01, 34.5], [2 * L.AFT_IN, 0.02, 7.0], { bev: 0 });
  for (let i = 0; i < 6; i++) kit.box('emitHot', [-3.0 + i * 1.2, FLOOR - 0.17, 34.5], [0.05, 0.02, 6.6], { bev: 0 });   // heat glow under the grating
  // sub-deck enclosure (visible through the grating): side walls and bulkheads between the grate level and the lower deck
  for (const sx of [-1, 1]) wall('x', sx * L.AFT_IN, 31.0, 38.0, { y0: FLOOR - 0.2, y1: FLOOR, col: false, skirt: false, mat: 'wallDark' });
  for (const z of [31.0, 38.0]) wall('z', z, -L.AFT_IN, L.AFT_IN, { y0: FLOOR - 0.2, y1: FLOOR, col: false, skirt: false, mat: 'wallDark' });

  // ───────── ceilings ─────────
  const cs = (x0, x1, z0, z1) => kit.box('ceil', [(x0 + x1) / 2, CEIL + 0.025, (z0 + z1) / 2], [x1 - x0, 0.05, z1 - z0], { bev: 0.004 });
  const S = L.STAIR;
  cs(-L.HAB_IN, L.HAB_IN, 2.4, S.holeZ0);
  cs(-L.HAB_IN, S.x0, S.holeZ0, S.holeZ1); cs(S.x1, L.HAB_IN, S.holeZ0, S.holeZ1);
  cs(-L.HAB_IN, L.HAB_IN, S.holeZ1, 24.0);
  cs(-L.AFT_IN, L.AFT_IN, 24.0, 38.0);
  // flight-deck bay: sloped ceiling polygon (plan), y = flightdeckCeil(z)
  {
    const F = L.FLIGHTDECK, poly = [[-F.podHW, F.podZ1], [F.podHW, F.podZ1], [F.bayHW, F.flareZ1], [F.bayHW, F.aftZ], [-F.bayHW, F.aftZ], [-F.bayHW, F.flareZ1]];
    const tri = THREE.ShapeUtils.triangulateShape(poly.map(([x, z]) => new THREE.Vector2(x, z)), []);
    const p = [], n = [], idx = [], b = (L.flightdeckCeil(2.4) - L.flightdeckCeil(0.35)) / 2.05;
    const nn = new V3(0, -1, b).normalize();
    for (const [x, z] of poly) { p.push(x, L.flightdeckCeil(z), z); n.push(nn.x, nn.y, nn.z); }
    for (const [a, c, d] of tri) {
      const e1 = new V3(poly[c][0] - poly[a][0], L.flightdeckCeil(poly[c][1]) - L.flightdeckCeil(poly[a][1]), poly[c][1] - poly[a][1]);
      const e2 = new V3(poly[d][0] - poly[a][0], L.flightdeckCeil(poly[d][1]) - L.flightdeckCeil(poly[a][1]), poly[d][1] - poly[a][1]);
      if (e1.cross(e2).dot(nn) >= 0) idx.push(a, c, d); else idx.push(a, d, c);
    }
    kit.arrays('ceil', { p, n, idx });
  }
  // structural ribs across the ceiling (every 3 m) + corridor light panels
  for (let z = 3.0; z <= 23.5; z += 3.0) {
    if (z > S.holeZ0 - 0.2 && z < S.holeZ1 + 0.2) { kit.box('trim', [-0.5, CEIL - 0.03, z], [1.2, 0.06, 0.1], { bev: 0.004 }); kit.box('trim', [-2.6, CEIL - 0.03, z], [2.8, 0.06, 0.1], { bev: 0.004 }); continue; }
    kit.box('trim', [0, CEIL - 0.03, z], [2.2, 0.06, 0.1], { bev: 0.004 });
  }
  for (const z of [4.3, 7.3, 13.3, 16.3, 19.3, 22.3]) kit.box('emitPanel', [0, CEIL - 0.008, z], [0.5, 0.016, 1.5], { bev: 0 });
  kit.box('emitPanel', [-0.55, CEIL - 0.008, 10.3], [0.3, 0.016, 1.5], { bev: 0 });
  for (const sx of [-1, 1]) for (const [z0, z1] of [[2.6, 7.6], [11.7, 23.8]]) kit.box('emitStrip', [sx * 1.05, CEIL - 0.012, (z0 + z1) / 2], [0.03, 0.02, z1 - z0], { bev: 0 });
  // cargo + engineering + flight deck ceiling lights
  for (const z of [25.5, 28.5]) for (const x of [-2.0, 2.0]) kit.box('emitPanel', [x, CEIL - 0.008, z], [0.6, 0.016, 1.8], { bev: 0 });
  for (const z of [33.0, 36.0]) for (const x of [-2.3, 2.3]) kit.box('emitWarm', [x, CEIL - 0.008, z], [0.5, 0.016, 1.6], { bev: 0 });
  kit.box('emitPanel', [0, L.flightdeckCeil(1.5) - 0.01, 1.5], [1.6, 0.016, 0.5], { bev: 0 });
  kit.box('emitStrip', [-2.0, L.flightdeckCeil(1.4) - 0.01, 1.3], [0.03, 0.02, 1.4], { bev: 0 }); kit.box('emitStrip', [2.0, L.flightdeckCeil(1.4) - 0.01, 1.3], [0.03, 0.02, 1.4], { bev: 0 });

  // ───────── corridor walls, partitions, outer lining ─────────
  const corrHoles = (side) => L.DOORS.filter((d) => d.axis === 'x' && Math.sign(d.x) === side).map(doorHole);
  const wallXpos = L.CORRIDOR_HW + T / 2;
  const solidP = wall('x', -wallXpos, 2.4, 24.0, { holes: corrHoles(-1) });
  const solidS = wall('x', wallXpos, 2.4, 24.0, { holes: corrHoles(1) });
  // corridor fittings on the solid wall ranges: orange band, hand rail, cyan floor guide
  const stairSkip = [S.zTop - 0.25, S.zFoot + 0.35];                    // starboard fittings must not run through the dome stair
  for (const [side, solids0] of [[-1, solidP], [1, solidS]]) {
    const xs = side * (L.CORRIDOR_HW - 0.006);
    const solids = [];
    for (const [c0, c1] of solids0) {
      if (side < 0 || c1 <= stairSkip[0] || c0 >= stairSkip[1]) { solids.push([c0, c1]); continue; }
      if (c0 < stairSkip[0]) solids.push([c0, stairSkip[0]]);
      if (c1 > stairSkip[1]) solids.push([stairSkip[1], c1]);
    }
    for (const [c0, c1] of solids) {
      const a = c0 + 0.1, b = c1 - 0.1, len = b - a; if (len < 0.4) continue; const mid = (a + b) / 2;
      kit.box('paintOrange', [xs, -0.2, mid], [0.012, 0.07, len], { bev: 0.002 });
      kit.box('wallDark', [xs, -0.62, mid], [0.014, 0.46, len], { bev: 0.003 });
      kit.box('emitStrip', [side * (L.CORRIDOR_HW - 0.012), -0.9, mid], [0.014, 0.018, len], { bev: 0 });
      // hand rail (brackets every 1.4 m)
      kit.beam('metal', [side * (L.CORRIDOR_HW - 0.09), 0.05, a], [side * (L.CORRIDOR_HW - 0.09), 0.05, b], 0.035, 0.035, { bev: 0.01 });
      for (let z = a + 0.2; z < b; z += 1.4) kit.box('trim', [side * (L.CORRIDOR_HW - 0.045), 0.05, z], [0.09, 0.05, 0.05], { bev: 0.004 });
    }
  }
  // ceiling pipe runs along both corridor walls (broken at the stair opening on the starboard side)
  for (const sx of [-1, 1]) {
    const runs = sx < 0 ? [[2.6, 23.8]] : [[2.6, S.holeZ0 - 0.3], [S.holeZ1 + 0.3, 23.8]];
    for (const [a, b] of runs) {
      kit.beam(sx < 0 ? 'paintCyan' : 'paintOrange', [sx * 0.9, CEIL - 0.14, a], [sx * 0.9, CEIL - 0.14, b], 0.07, 0.07, { bev: 0.02 });
      kit.beam('metal', [sx * 0.78, CEIL - 0.12, a], [sx * 0.78, CEIL - 0.12, b], 0.04, 0.04, { bev: 0.012 });
      for (let z = a + 0.4; z < b; z += 1.2) kit.box('trim', [sx * 0.84, CEIL - 0.1, z], [0.2, 0.2, 0.06], { bev: 0.006 });
    }
  }
  // partitions (z-normal walls) between the side rooms; room-front walls at z=3
  for (const z of [3.0, 8.0, 14.0, 18.0]) wall('z', z, -L.HAB_IN, -L.ROOM_IN_X);
  for (const z of [3.0, 10.0, 14.0, 18.0]) wall('z', z, L.ROOM_IN_X, L.HAB_IN);
  // outer lining of the habitat with window/hatch openings
  const winHole = (w) => w.kind === 'round' ? { c0: w.z - w.r - 0.03, c1: w.z + w.r + 0.03, y0: w.y - w.r - 0.03, y1: w.y + w.r + 0.03 } : { c0: w.z - w.w / 2, c1: w.z + w.w / 2, y0: w.y - w.h / 2, y1: w.y + w.h / 2 };
  const sideHoles = (s, zMax, zMin) => L.WINDOWS.filter((w) => w.side === s && w.z <= zMax && w.z >= zMin).map(winHole);
  const hatchHole = { c0: L.HATCH.z - L.HATCH.hw, c1: L.HATCH.z + L.HATCH.hw, y0: FLOOR, y1: L.HATCH.y1 };
  wall('x', -L.HAB_IN, 3.0, 18.0, { holes: [...sideHoles(-1, 18, 3), hatchHole] });
  wall('x', L.HAB_IN, 3.0, 18.0, { holes: sideHoles(1, 18, 3) });
  // cargo + engineering lining and bulkheads
  wall('x', -L.AFT_IN, 24.0, 38.0, { holes: sideHoles(-1, 38, 24) });
  wall('x', L.AFT_IN, 24.0, 38.0, { holes: sideHoles(1, 38, 24) });
  wall('z', 24.0, -L.AFT_IN, L.AFT_IN, { holes: [doorHole(D.cargo)] });
  wall('z', 31.0, -L.AFT_IN, L.AFT_IN, { holes: [doorHole(D.engineering)] });
  const EW = L.ENG_WINDOW;
  wall('z', 38.0, -L.AFT_IN, L.AFT_IN, { holes: [{ c0: EW.x0, c1: EW.x1, y0: EW.y0, y1: EW.y1 }] });
  // flight deck: aft bulkhead (door), straight side walls, diagonal flare walls
  wall('z', 2.4, -3.0, 3.0, { holes: [doorHole(D.flightdeck)] });
  const F = L.FLIGHTDECK;
  for (const s of [-1, 1]) {
    wall('x', s * F.bayHW, F.flareZ1, 2.4, {}); // straight part
    const x0 = s * F.podHW, z0 = F.podZ1, x1 = s * F.bayHW, z1 = F.flareZ1, dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
    const c0 = L.flightdeckCeil(z0), c1 = L.flightdeckCeil(z1);
    const g = extrudePoly([[0, FLOOR], [len, FLOOR], [len, c1], [0, c0]], T, 0.004);
    kit.add('wall', g, { pos: [x0, 0, z0], rot: [0, yaw, 0] }); g.dispose();
    kit.colBox([(x0 + x1) / 2, yMid, (z0 + z1) / 2], [len, H, T], { yaw });
  }

  // ───────── sliding doors (InstancedMesh leaves, one draw call each layer) ─────────
  const leaves = [];
  for (const d of L.DOORS) {
    const n = d.leaves, lw = n === 1 ? d.width + 0.04 : d.width / 2 + 0.03, lh = d.h + 0.02, th = 0.07;
    const dirs = n === 2 ? [-1, 1] : [d.id === 'engineering' ? -1 : 1];
    const door = { id: d.id, pos: new V3(d.x, FLOOR + 1.0, d.z), open: 0, time: 0.6, locked: false, forceOpen: false, leaves: [], rooms: d.rooms };
    dirs.forEach((dir, i) => {
      const off = n === 2 ? dir * (d.width / 4 + 0.0) : 0;
      door.leaves.push({ axis: d.axis, dir, base: d.axis === 'x' ? new V3(d.x, FLOOR + d.h / 2, d.z + off) : new V3(d.x + off, FLOOR + d.h / 2, d.z), w: lw, h: lh, th, travel: n === 2 ? d.width / 2 : d.width });
    });
    door.collider = kit.colBox(d.axis === 'x' ? [d.x, yMid, d.z] : [d.x, yMid, d.z], d.axis === 'x' ? [T, H, d.width] : [d.width, H, T], { door: true, name: `door.${d.id}` });
    kit.doors.push(door); leaves.push(...door.leaves.map((l) => ({ door, l })));
    // frame
    const hw = d.width / 2, fh = d.h;
    if (d.axis === 'x') {
      for (const s of [-1, 1]) kit.box('trim', [d.x, FLOOR + fh / 2, d.z + s * (hw + 0.05)], [T + 0.06, fh + 0.1, 0.1], { bev: 0.01 });
      kit.box('trim', [d.x, FLOOR + fh + 0.05, d.z], [T + 0.06, 0.1, d.width + 0.2], { bev: 0.01 });
      for (const sd of [-1, 1]) {   // accent strips on both faces of the frame
        kit.box('emitStrip', [d.x + sd * (T / 2 + 0.033), FLOOR + fh / 2, d.z - hw - 0.1 + 0.0], [0.006, fh + 0.1, 0.014], { bev: 0 });
        kit.box('emitStrip', [d.x + sd * (T / 2 + 0.033), FLOOR + fh / 2, d.z + hw + 0.1], [0.006, fh + 0.1, 0.014], { bev: 0 });
      }
      kit.box('hazard', [d.x, FLOOR + 0.012, d.z], [T * 0.9, 0.012, d.width], { bev: 0 });
    } else {
      for (const s of [-1, 1]) kit.box('trim', [d.x + s * (hw + 0.05), FLOOR + fh / 2, d.z], [0.1, fh + 0.1, T + 0.06], { bev: 0.01 });
      kit.box('trim', [d.x, FLOOR + fh + 0.05, d.z], [d.width + 0.2, 0.1, T + 0.06], { bev: 0.01 });
      for (const sd of [-1, 1]) {
        kit.box('emitStrip', [d.x - hw - 0.1, FLOOR + fh / 2, d.z + sd * (T / 2 + 0.033)], [0.014, fh + 0.1, 0.006], { bev: 0 });
        kit.box('emitStrip', [d.x + hw + 0.1, FLOOR + fh / 2, d.z + sd * (T / 2 + 0.033)], [0.014, fh + 0.1, 0.006], { bev: 0 });
      }
    }
    // status LED beside the door
    {
      const cs = d.axis === 'x' ? -Math.sign(d.x) : (d.z < 5 || d.z > 30 ? 1 : -1);               // normal toward the corridor / entry side
      const ledPos = d.axis === 'x' ? [d.x + cs * (T / 2 + 0.012), FLOOR + fh - 0.1, d.z - hw - 0.17] : [d.x - hw - 0.17, FLOOR + fh - 0.1, d.z + cs * (T / 2 + 0.012)];
      kit.box(kit.led(eur ? 'Red' : 'Green'), ledPos, [0.02, 0.02, 0.02], { bev: 0 });
    }
  }
  {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mk = (mat) => { const im = new THREE.InstancedMesh(geo, kit.mat(mat), leaves.length); im.frustumCulled = false; im.receiveShadow = true; im.castShadow = false; kit.root.add(im); return im; };
    const imBody = mk('white'), imBand = mk('trim'), imStrip = mk('emitStrip');
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), ps = new V3();
    const write = (i, door, l, o) => {
      const slide = l.dir * o * l.travel * 0.97;
      const px = l.base.x + (l.axis === 'z' ? slide : 0), pz = l.base.z + (l.axis === 'x' ? slide : 0);
      const along = l.axis === 'x' ? 'z' : 'x';
      // body
      sc.set(l.axis === 'x' ? l.th : l.w, l.h, l.axis === 'x' ? l.w : l.th); ps.set(px, l.base.y, pz); imBody.setMatrixAt(i, m4.compose(ps, q, sc));
      // dark band at mid height
      sc.set(l.axis === 'x' ? l.th + 0.012 : l.w * 0.98, 0.14, l.axis === 'x' ? l.w * 0.98 : l.th + 0.012); ps.set(px, l.base.y + 0.1, pz); imBand.setMatrixAt(i, m4.compose(ps, q, sc));
      // emissive leading-edge strip
      const edge = (l.w / 2 - 0.03) * l.dir * -1;   // leading edge faces the opening centre
      sc.set(l.axis === 'x' ? l.th + 0.014 : 0.024, l.h - 0.3, l.axis === 'x' ? 0.024 : l.th + 0.014);
      ps.set(px + (l.axis === 'z' ? edge : 0), l.base.y, pz + (l.axis === 'x' ? edge : 0)); imStrip.setMatrixAt(i, m4.compose(ps, q, sc));
    };
    kit.doors.forEach((door) => {
      door.apply = (o) => {
        door.collider.open = o;
        for (const l of door.leaves) { const i = leaves.findIndex((e) => e.l === l); write(i, door, l, o); }
        imBody.instanceMatrix.needsUpdate = imBand.instanceMatrix.needsUpdate = imStrip.instanceMatrix.needsUpdate = true;
      };
    });
    leaves.forEach(({ door, l }, i) => write(i, door, l, 0));
    if (eur) { // derelict: doors jammed at assorted openings
      const stuck = { flightdeck: 1, quarters: 0.78, galley: 1, airlock: 0.9, lab: 0.7, medbay: 0.85, core: 0, cargo: 1, engineering: 0.8 };
      kit.doors.forEach((door) => { const v = stuck[door.id]; if (v != null) { door.stuck = v; door.locked = true; door.open = v; door.apply(v); } });
    }
  }
  // door name plates (corridor side) + deck/room labels
  const names = { quarters: 'QUARTERS', galley: 'GALLEY', airlock: 'AIRLOCK', lab: 'SCIENCE LAB', medbay: 'MEDBAY', core: 'LYRA CORE' };
  for (const d of L.DOORS) {
    if (d.axis === 'x') {
      const side = Math.sign(d.x);
      kit.sign(names[d.id], [side * (L.CORRIDOR_HW - 0.012), FLOOR + d.h + 0.2, d.z], { w: 0.74, h: 0.13, rot: [0, -side * Math.PI / 2, 0], style: d.id === 'airlock' ? 'warn' : 'door' });
    } else if (d.id === 'cargo') {
      kit.sign('CARGO BAY', [0, FLOOR + d.h + 0.2, 24.0 - T / 2 - 0.012], { w: 0.8, h: 0.13, rot: [0, Math.PI, 0], style: 'door' });
      kit.sign('CARGO BAY', [0, FLOOR + d.h + 0.2, 24.0 + T / 2 + 0.012], { w: 0.8, h: 0.13, rot: [0, 0, 0], style: 'door' });
    } else if (d.id === 'engineering') {
      kit.sign('ENGINEERING', [2.4, FLOOR + d.h + 0.2, 31.0 + T / 2 + 0.012], { w: 0.8, h: 0.13, rot: [0, 0, 0], style: 'door' });
      kit.sign('CARGO BAY', [2.4, FLOOR + d.h + 0.2, 31.0 - T / 2 - 0.012], { w: 0.8, h: 0.13, rot: [0, Math.PI, 0], style: 'door' });
    } else if (d.id === 'flightdeck') {
      kit.sign('FLIGHT DECK', [0, FLOOR + d.h + 0.2, 2.4 + T / 2 + 0.012], { w: 0.8, h: 0.13, rot: [0, 0, 0], style: 'door' });
      kit.sign('SPINE CORRIDOR', [0, FLOOR + d.h + 0.2, 2.4 - T / 2 - 0.012], { w: 0.8, h: 0.13, rot: [0, Math.PI, 0], style: 'door' });
    }
  }
  kit.sign('OBSERVATION DOME  ▲', [L.CORRIDOR_HW - 0.012, 0.55, 12.9], { w: 0.9, h: 0.13, rot: [0, -Math.PI / 2, 0], style: 'door' });
  kit.sign('DECK 1 · SPINE', [-(L.CORRIDOR_HW - 0.012), 0.35, 9.0], { w: 0.7, h: 0.11, rot: [0, Math.PI / 2, 0], style: 'plate' });
  kit.sign('HX-02', [-(L.CORRIDOR_HW - 0.012), 0.35, 21.5], { w: 0.5, h: 0.11, rot: [0, Math.PI / 2, 0], style: 'plate' });

  // ───────── windows: bezels, glass, reveal tunnels, hull skin cuts ─────────
  const ringPlate = (rIn, rOut, depth) => {
    const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 24 });
    g.translate(0, 0, -depth / 2); return g;
  };
  for (const w of L.WINDOWS) {
    const s = w.side, inner = L.innerX(w.z), skin = L.skinX(w.z), xm = s * (inner + skin) / 2, gap = skin - inner;
    if (w.kind === 'round') {
      const g = ringPlate(w.r, w.r + 0.1, 0.06); kit.add('trim', g, { pos: [s * (inner - 0.0), w.y, w.z], rot: [0, -s * Math.PI / 2, 0] }); g.dispose();
      kit.cyl('trimDS', [xm, w.y, w.z], w.r + 0.004, gap, { axis: 'x', open: true, seg: 28 });
      kit.cyl('glassInt', [s * (inner + gap * 0.62), w.y, w.z], w.r, 0.012, { axis: 'x', seg: 28 });
      kit.cutRound(0, w.z, w.y, w.r + 0.01, s > 0 ? inner - 0.05 : -skin - 2, s > 0 ? skin + 2 : -(inner - 0.05));
    } else {
      const hw = w.w / 2, hh = w.h / 2;
      for (const sd of [-1, 1]) {
        kit.box('trim', [s * inner, w.y + sd * (hh + 0.045), w.z], [0.07, 0.09, w.w + 0.18], { bev: 0.008 });
        kit.box('trim', [s * inner, w.y, w.z + sd * (hw + 0.045)], [0.07, w.h, 0.09], { bev: 0.008 });
        kit.box('trimDS', [xm, w.y + sd * hh, w.z], [gap, 0.01, w.w], { bev: 0 });
        kit.box('trimDS', [xm, w.y, w.z + sd * hw], [gap, w.h, 0.01], { bev: 0 });
      }
      kit.box('glassInt', [s * (inner + gap * 0.62), w.y, w.z], [0.012, w.h, w.w], { bev: 0 });
      kit.cutRect(0, w.z, w.y, hw + 0.01, hh + 0.01, w.rc || 0.1, s > 0 ? inner - 0.05 : -skin - 2, s > 0 ? skin + 2 : -(inner - 0.05));
    }
  }
  // airlock hatch opening + dome opening in the hull skin
  kit.cutRect(0, L.HATCH.z, (L.HATCH.y0 + L.HATCH.y1) / 2, L.HATCH.hw + 0.01, (L.HATCH.y1 - L.HATCH.y0) / 2 + 0.01, 0.08, -L.HAB_SKIN - 2, -(L.HAB_IN - 0.05));
  kit.cutRound(1, L.DOME.cx, L.DOME.cz, L.DOME.r + 0.02, 1.0, 8.0);
  // drive-bay viewport frame (glass + chamber behind are built by engineering.js)

  // ───────── room floor markers ─────────
  kit.box('paintCyan', [0, FLOOR + 0.002, 24.2], [1.6, 0.004, 0.06], { bev: 0 });
}
