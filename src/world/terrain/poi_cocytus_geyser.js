// ORPHEUS · Cocytus / Wailing Field (slot `geyser`, padR 12) — the geyser monitor station.
// A heated insulated hut with an arctic-entry porch (field recorder inside the doorway), a lattice instrument tower (anemometer + vane spin), a small wind turbine
// whose blades spin FAST, lagged steam-sampling pipe + hose stubbed toward vent #1, bottle rack, cable drums, a lifeline with fluttering pennants and snow banked
// against the windward walls. Everything is frost-crusted on the windward/up faces (poi_cocytus_frost.js). Wind: TOWARD (0.995, 0, -0.10) ship space.
import * as THREE from 'three';
import { GM, makeFrame, makeBatch, identityFrame, paintTexture, brushedTexture, bootsTexture, rbox, strut, tubeGeo, obbBoxes, groundPatch, mergeAll } from './poi_charon_icekit.js';
import { makeFrost, WIND_TO, icicleRow, addIcicles, driftGeo, steamPlume } from './poi_cocytus_frost.js';

const HUT = { x: 0.5, z: -1.8, L: 7.2, W: 3.6, H: 2.7, R: 1.25 };      // vault along local X; front wall plane z = 0
const PORCH = { x: 2.7, w: 2.0, d: 2.0, h: 2.35 };
const TOWER = { x: -7.3, z: -6.4, h: 9.0 };
const TURB = { x: -9.9, z: 3.0, h: 6.4 };
const box = GM.Box;
const cyl = (rt, rb, h, seg = 12) => GM.Cylinder(rt, rb, h, seg);

/** smooth-shaded vault: profile (z across, y up) swept along x from x0 to x1, closed with flat end caps */
function vaultGeo(x0, x1, W, H, R, zc, nArc = 10) {
  const pr = [[W / 2 - 0.07, 0], [W / 2, 0.12], [W / 2, H - R]];
  for (let i = 1; i <= nArc; i++) { const a = i / nArc * Math.PI / 2; pr.push([W / 2 - R + Math.cos(a) * R, H - R + Math.sin(a) * R]); }
  for (let i = 0; i <= nArc; i++) { const a = Math.PI / 2 + i / nArc * Math.PI / 2; pr.push([-(W / 2 - R) + Math.cos(a) * R, H - R + Math.sin(a) * R]); }
  pr.push([-W / 2, 0.12], [-W / 2 + 0.07, 0]);
  const n = pr.length, pos = [], nor = [], uv = [], idx = [], len = x1 - x0;
  const nrm = pr.map((q, i) => {
    const a = pr[Math.max(0, i - 1)], b = pr[Math.min(n - 1, i + 1)], dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1;
    return [dy / l, -dz / l];                                                          // outward normal (z, y) for a CCW profile
  });
  let arc = 0; const av = [0]; for (let i = 1; i < n; i++) { arc += Math.hypot(pr[i][0] - pr[i - 1][0], pr[i][1] - pr[i - 1][1]); av.push(arc); }
  for (let i = 0; i < n; i++) for (const [x, u] of [[x0, 0], [x1, len * 0.5]]) { pos.push(x, pr[i][1], zc + pr[i][0]); nor.push(0, nrm[i][1], nrm[i][0]); uv.push(u, av[i] * 0.5); }
  for (let i = 0; i < n - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
  for (const [x, nx] of [[x0, -1], [x1, 1]]) {
    const base = pos.length / 3;
    pos.push(x, H * 0.5, zc); nor.push(nx, 0, 0); uv.push(0.5, 0.5);
    for (let i = 0; i < n; i++) { pos.push(x, pr[i][1], zc + pr[i][0]); nor.push(nx, 0, 0); uv.push(pr[i][0] * 0.5, pr[i][1] * 0.5); }
    for (let i = 0; i < n - 1; i++) { if (nx > 0) idx.push(base, base + 2 + i, base + 1 + i); else idx.push(base, base + 1 + i, base + 2 + i); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

const lagTexture = (kit) => kit.canvasTexture(128, 128, (g, W, H) => {
  const r = kit.mulberry32(6);
  g.fillStyle = '#d9e6ee'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(60,80,100,0.12)'; g.fillRect(r() * W, r() * H, 2 + r() * 6, 1 + r() * 2); }
  g.strokeStyle = 'rgba(70,90,110,0.55)'; g.lineWidth = 1.6; for (let x = -H; x < W; x += 14) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H * 0.7, 0); g.stroke(); }     // spiral wrap tape
  g.fillStyle = '#7b8791'; g.fillRect(0, 0, 9, H); g.fillStyle = '#e8650f'; g.fillRect(9, 0, 3, H); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 1.5, H);   // steel band + orange ring
}, { aniso: 4 });
const hoseTexture = (kit) => kit.canvasTexture(16, 64, (g, W, H) => { for (let y = 0; y < H; y += 4) { g.fillStyle = (y / 4) % 2 ? '#2a2e33' : '#454b52'; g.fillRect(0, y, W, 4); } g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 3, H); }, { aniso: 4 });
const flagGlsl = {
  head: 'attribute float aFl; attribute float aPh; uniform float uTime;',
  body: ' float fw = sin(uTime * 17.0 + aFl * 8.0 + aPh) * (0.6 + 0.4 * sin(uTime * 3.1 + aPh * 2.0)); transformed += normal * fw * 0.075 * aFl; transformed.y += sin(uTime * 11.0 + aPh) * 0.022 * aFl;',
};

export function buildGeyser(env, slot) {
  const { kit } = env, fr = makeFrame(env, slot), group = new THREE.Group(); group.name = 'wailing_station';
  const rng = kit.rng('geyser'), colliders = [], updaters = [];
  const { frostify } = makeFrost();
  const S = (o) => kit.std({ color: 0xffffff, ...o });
  const wl = fr.dirL(WIND_TO.x, WIND_TO.z), wlen = Math.hypot(wl[0], wl[1]), wd = [wl[0] / wlen, wl[1] / wlen];     // wind (toward), slot-local unit [x, z]
  const windYaw = Math.atan2(-wd[0], -wd[1]);                                                                   // local +Z → upwind
  const vent = env.site.vents?.[0] || { x: fr.x + 90, z: fr.z - 20 };
  const vdir = (() => { const d = fr.dirL(vent.x - fr.x, vent.z - fr.z), l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; })();
  const vang = Math.atan2(vdir[0], vdir[1]), vnrm = [-vdir[1], vdir[0]], ventDist = Math.round(Math.hypot(vent.x - fr.x, vent.z - fr.z));

  const mat = {
    paint: frostify(S({ map: paintTexture(kit, { base: '#d6e0e6', cols: 6, rows: 3, seed: 53, seam: 'rgba(40,56,70,0.5)', wear: 0.5, grimeAmt: 0.35, pits: 0.1 }), vertexColors: true, roughness: 0.62, metalness: 0.06 }), { amount: 1 }),
    metal: frostify(S({ map: brushedTexture(kit, { dir: 'u', base: '#c4cbd1' }), vertexColors: true, roughness: 0.4, metalness: 0.55 }), { amount: 0.9 }),
    dark: frostify(S({ vertexColors: true, roughness: 0.82, metalness: 0.08 }), { amount: 0.9 }),
    lag: frostify(S({ map: lagTexture(kit), roughness: 0.72 }), { amount: 0.75 }),
    hose: frostify(S({ map: hoseTexture(kit), roughness: 0.6 }), { amount: 0.7 }),
    snow: frostify(S({ roughness: 0.9 }), { amount: 1, bias: 2.0, rough: 0.85, sparkle: 0.2 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
    ice: S({ color: 0xe0f2fc, roughness: 0.14, transparent: true, opacity: 0.88, emissive: 0x0c2236 }),
    bottle: S({ vertexColors: true, roughness: 0.12, transparent: true, opacity: 0.82 }),
    spin: S({ vertexColors: true, roughness: 0.5, metalness: 0.35 }),
    blur: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.62, 0.7), transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false }),
  };
  const P = makeBatch(fr, 20000), M = makeBatch(fr, 28000), D = makeBatch(fr, 12000), G = makeBatch(fr, 2000), ICE = makeBatch(fr, 3000), BOT = makeBatch(fr, 4000);
  const gl = (x, z) => fr.gy(x, z) - fr.y0;                                    // terrain height offset at local (x, z)

  // ── hut: skirt runners, vault shell, windows, vent stack, antenna ──
  const hx0 = HUT.x - HUT.L / 2, hx1 = HUT.x + HUT.L / 2, zf = HUT.z + HUT.W / 2;     // zf = front wall plane (= 0)
  for (const s of [-1, 1]) D.add(box(HUT.L + 0.4, 0.32, 0.34), { p: [HUT.x, 0.1, HUT.z + s * 1.2], color: 0x3a4148 });
  D.add(box(HUT.L + 0.1, 0.18, HUT.W - 0.1), { p: [HUT.x, 0.12, HUT.z], color: 0x4a525a });
  P.add(vaultGeo(hx0, hx1, HUT.W, HUT.H, HUT.R, HUT.z), { color: 0xe3ebf0, uv: 0, dirt: 0.35, dirtH: 1.0 });
  for (const [x, k] of [[-1.7, 1], [-0.2, 0.8]]) {            // front windows (lit)
    const wx = HUT.x + x;
    D.add(rbox(0.82, 0.58, 0.08, 0.04), { p: [wx, 1.45, zf + 0.025], color: 0x2b3238 });
    G.add(GM.Plane(0.66, 0.42), { p: [wx, 1.45, zf + 0.07], color: [3.4 * k, 2.0 * k, 0.8 * k], uv: 0 });
    D.add(box(0.03, 0.42, 0.02), { p: [wx, 1.45, zf + 0.08], color: 0x20262b });
    M.add(box(0.9, 0.04, 0.12), { p: [wx, 1.14, zf + 0.06], color: 0xb4bcc4 });
  }
  D.add(rbox(0.5, 0.5, 0.08, 0.04), { p: [hx0 - 0.02, 1.5, HUT.z], r: [0, -Math.PI / 2, 0], color: 0x2b3238 });        // porthole in the windward end
  G.add(GM.Circle(0.19, 18), { p: [hx0 - 0.07, 1.5, HUT.z], r: [0, -Math.PI / 2, 0], color: [2.6, 1.55, 0.65], uv: 0 });
  M.add(cyl(0.12, 0.12, 0.95, 12), { p: [HUT.x - 1.2, HUT.H + 0.35, HUT.z - 0.2], color: 0xb0b8c0 });
  M.add(GM.Cone(0.22, 0.14, 12), { p: [HUT.x - 1.2, HUT.H + 0.9, HUT.z - 0.2], color: 0x8a929a });
  M.add(cyl(0.16, 0.16, 0.08, 12), { p: [HUT.x - 1.2, HUT.H - 0.02, HUT.z - 0.2], color: 0x70787f });
  M.add(cyl(0.012, 0.016, 1.6, 6), { p: [HUT.x + 2.6, HUT.H + 0.75, HUT.z - 0.7], color: 0xc4cad0 });
  M.add(cyl(0.012, 0.016, 1.1, 6), { p: [HUT.x + 3.0, HUT.H + 0.5, HUT.z - 0.9], color: 0xc4cad0 });
  P.add(rbox(0.42, 0.28, 0.3, 0.04), { p: [HUT.x + 2.8, HUT.H + 0.1, HUT.z - 0.8], color: 0xd9e2e8 });

  // ── arctic-entry porch: open outer door, lit interior (recorder inside) ──
  const px = PORCH.x, pz1 = PORCH.d, ph = PORCH.h, dw = 1.05, dh = 2.0, jambW = (PORCH.w - dw) / 2, floorY = 0.26;
  P.add(box(jambW, ph, 0.14), { p: [px - dw / 2 - jambW / 2, ph / 2, pz1 - 0.07], color: 0xe3ebf0, dirt: 0.3 });
  P.add(box(jambW, ph, 0.14), { p: [px + dw / 2 + jambW / 2, ph / 2, pz1 - 0.07], color: 0xe3ebf0, dirt: 0.3 });
  P.add(box(dw, ph - dh, 0.14), { p: [px, dh + (ph - dh) / 2, pz1 - 0.07], color: 0xe3ebf0 });
  for (const s of [-1, 1]) P.add(box(0.12, ph, pz1), { p: [px + s * (PORCH.w / 2 - 0.06), ph / 2, pz1 / 2], color: 0xe3ebf0, dirt: 0.3 });
  P.add(box(PORCH.w + 0.16, 0.14, pz1 + 0.18), { p: [px, ph + 0.06, pz1 / 2 + 0.06], color: 0xcfd9e0 });
  D.add(box(PORCH.w - 0.2, 0.1, pz1 - 0.1), { p: [px, floorY - 0.05, pz1 / 2], color: 0x3a4148 });
  D.add(box(1.5, 0.18, 0.6), { p: [px, 0.09, pz1 + 0.3], color: 0x4a525a });
  D.add(box(0.7, 0.05, 0.4), { p: [px + 0.1, floorY + 0.02, pz1 - 0.4], color: 0x20252a });                 // boot grating
  P.add(rbox(0.96, 1.96, 0.07, 0.03), { p: [px - 0.1, floorY + 0.98, 0.07], color: 0xd0dae1 });              // inner door on the hut wall
  G.add(GM.Plane(0.34, 0.26), { p: [px - 0.1, 1.72, 0.115], color: [1.6, 2.3, 3.0], uv: 0 });
  for (const s of [-1, 1]) M.add(box(0.06, 2.1, 0.06), { p: [px - 0.1 + s * 0.52, floorY + 1.05, 0.06], color: 0xe8b21a });
  G.add(GM.Plane(1.5, 0.3), { p: [px, ph - 0.07, pz1 / 2], r: [Math.PI / 2, 0, 0], color: [9, 7, 5], uv: 0 });   // ceiling light
  P.add(box(0.9, 0.04, 0.32), { p: [px + 0.55, floorY + 1.55, 0.18], color: 0xc9d3da });                    // coat shelf with parkas on hooks
  [0xe8650f, 0x2a5aa8, 0xd8d0c4].forEach((col, i) => { const x = px + 0.32 + i * 0.2; M.add(cyl(0.012, 0.012, 0.1, 5), { p: [x, floorY + 1.5, 0.07], r: [Math.PI / 2, 0, 0], color: 0xb4bcc4 }); P.add(rbox(0.18, 0.62, 0.1, 0.04), { p: [x, floorY + 1.15, 0.1], color: col, uv: 0 }); });
  {                                                                                                          // outer door swung wide on its left hinge
    const a = -100 * Math.PI / 180, hx = px - dw / 2, hz = pz1, cx = hx + Math.cos(a) * 0.49, cz = hz - Math.sin(a) * 0.49;
    P.add(rbox(0.98, 2.0, 0.07, 0.03), { p: [cx, 1.0, cz], r: [0, a, 0], color: 0xd6dfe5 });
    G.add(GM.Plane(0.3, 0.24), { p: [cx - Math.sin(a) * 0.045, 1.65, cz - Math.cos(a) * 0.045], r: [0, a, 0], color: [0.35, 0.5, 0.7], uv: 0 });
  }
  { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.24), S({ map: kit.labelTexture(['GEYSER MONITOR', 'WAILING FIELD'], { w: 256, h: 96, bg: '#e8650f', fg: '#14181c', size: 26 }), roughness: 0.6 })); fr.place(t, px, dh + (ph - dh) / 2, pz1 + 0.01); t.castShadow = false; group.add(t); }

  // ── instrument tower: lattice, platform with logger / pressure port / thermal camera, ladder, spinning anemometer + vane, beacon ──
  {
    const x0 = TOWER.x, z0 = TOWER.z, H = TOWER.h, g0 = gl(x0, z0), half = (y) => 0.82 - 0.46 * (y / H), cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const lp = (i, y) => [x0 + cs[i][0] * half(y), g0 + y, z0 + cs[i][1] * half(y)];
    D.add(rbox(2.3, 0.3, 2.3, 0.04), { p: [x0, g0, z0], color: 0x59616a });
    for (let i = 0; i < 4; i++) { M.add(strut(lp(i, 0.1), lp(i, H), 0.055, 0.035), { uv: 0, color: 0xdde3e8 }); colliders.push(kit.cyl(fr.wx(lp(i, 0)[0], lp(i, 0)[2]), fr.wz(lp(i, 0)[0], lp(i, 0)[2]), 0.2, fr.y0 - 0.3, fr.y0 + H)); }
    for (let y = 0.1; y < H - 0.3; y += 1.5) for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4; M.add(strut(lp(i, y), lp(j, y), 0.02), { uv: 0, color: 0xcdd5db });
      M.add(strut(lp(i, y), lp(j, y + 1.5), 0.016), { uv: 0, color: 0xc4ccd2 }); M.add(strut(lp(j, y), lp(i, y + 1.5), 0.016), { uv: 0, color: 0xc4ccd2 });
    }
    const py = 5.4, hp = half(py) + 0.12, rp = hp + 0.12;
    M.add(box(hp * 2 + 0.3, 0.07, hp * 2 + 0.3), { p: [x0, g0 + py, z0], color: 0xaab2ba });
    for (const [sx, sz] of cs) M.add(cyl(0.02, 0.02, 0.95, 6), { p: [x0 + sx * rp, g0 + py + 0.5, z0 + sz * rp], color: 0xe8b21a });
    for (let i = 0; i < 4; i++) { const a = cs[i], b = cs[(i + 1) % 4]; M.add(strut([x0 + a[0] * rp, g0 + py + 0.95, z0 + a[1] * rp], [x0 + b[0] * rp, g0 + py + 0.95, z0 + b[1] * rp], 0.02), { uv: 0, color: 0xe8b21a }); }
    P.add(rbox(0.56, 0.4, 0.36, 0.04), { p: [x0 - 0.3, g0 + py + 0.27, z0 + 0.1], color: 0xe4ebf0 });             // pressure / infrasound logger
    D.add(box(0.4, 0.2, 0.02), { p: [x0 - 0.3, g0 + py + 0.27, z0 + 0.29], color: 0x2a3036 });
    G.add(GM.Plane(0.12, 0.06), { p: [x0 - 0.3, g0 + py + 0.3, z0 + 0.302], color: [0.5, 2.4, 3.4], uv: 0 });
    M.add(cyl(0.025, 0.025, 0.55, 6), { p: [x0 + 0.3, g0 + py + 0.33, z0 - 0.2], color: 0xb4bcc4 });
    P.add(GM.Sphere(0.11, 14, 10), { p: [x0 + 0.3, g0 + py + 0.68, z0 - 0.2], color: 0xf2f6f8 });   // wind-screened pressure port
    const cam = [x0 + 0.35, g0 + py + 0.32, z0 + 0.5];                                                          // thermal camera aimed at vent #1
    D.add(cyl(0.15, 0.15, 0.42, 14), { p: cam, r: [Math.PI / 2, vang, 0], color: 0x2a3036 });
    D.add(cyl(0.11, 0.11, 0.03, 14), { p: [cam[0] + vdir[0] * 0.22, cam[1], cam[2] + vdir[1] * 0.22], r: [Math.PI / 2, vang, 0], color: 0x0a1218 });
    P.add(rbox(1.0, 0.7, 0.28, 0.04), { p: [x0, g0 + 3.2, z0 + half(3.2) + 0.2], color: 0xe8650f });             // battery box + small solar panel
    P.add(box(0.95, 0.04, 0.62), { p: [x0 + 0.95, g0 + 2.3, z0 + 0.55], r: [0.7, 0.2, 0], color: 0x233267 });
    D.add(box(0.5, 0.35, 0.5), { p: [x0 + 1.5, g0 + 0.3, z0 - 0.4], color: 0x353c43 });                          // geophone enclosure + cable
    M.add(tubeGeo([[x0 + 1.4, g0 + 0.2, z0 - 0.4], [x0 + 0.9, g0 + 0.06, z0 + 0.2], [x0 + 0.1, g0 + 0.1, z0 + 0.7]], 0.02, 5, 12), { uv: 0, color: 0x1c2024 });
    for (let y = 0.7; y < 5.2; y += 0.38) M.add(box(0.5, 0.025, 0.025), { p: [x0 - 0.2, g0 + y, z0 - half(y) - 0.13], color: 0xaab2ba });   // ladder
    for (const s of [-1, 1]) M.add(box(0.025, 5.2, 0.025), { p: [x0 - 0.2 + s * 0.25, g0 + 2.7, z0 - half(2.7) - 0.13], color: 0xaab2ba });
    M.add(cyl(0.032, 0.04, 1.2, 8), { p: [x0, g0 + H + 0.6, z0], color: 0xdde3e8 });                              // mast
    const sb = makeBatch(identityFrame(env));
    sb.add(cyl(0.03, 0.03, 0.1, 8), { color: 0x2a3036 });
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      sb.add(strut([0, 0.02, 0], [Math.sin(a) * 0.26, 0.02, Math.cos(a) * 0.26], 0.008), { uv: 0, color: 0x2a3036 });
      sb.add(GM.Sphere(0.065, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { p: [Math.sin(a) * 0.28, 0.02, Math.cos(a) * 0.28], r: [0, a, Math.PI / 2], color: i ? 0xf2f4f6 : 0xe8650f, uv: 0 });
    }
    const cupGroup = new THREE.Group(); cupGroup.add(sb.build(mat.spin)); fr.place(cupGroup, x0, g0 + H + 1.12, z0, 0); group.add(cupGroup);
    const vb = makeBatch(identityFrame(env));
    vb.add(strut([0, 0, -0.34], [0, 0, 0.3], 0.012), { uv: 0, color: 0x2a3036 }); vb.add(box(0.02, 0.2, 0.3), { p: [0, 0.02, -0.38], color: 0xe8650f }); vb.add(GM.Cone(0.035, 0.12, 8), { p: [0, 0, 0.36], r: [Math.PI / 2, 0, 0], color: 0xf2f4f6, uv: 0 });
    const vane = new THREE.Group(); vane.add(vb.build(mat.spin)); fr.place(vane, x0, g0 + H + 0.72, z0, 0); group.add(vane);
    const b = kit.beacon(fr.pos(x0, g0 + H + 1.4, z0).toArray(), { color: 0xff6a2c, size: 0.09, range: 34, lightI: 18, period: 2.5, duty: 0.12 }); group.add(b.group);
    updaters.push((dt, t) => { b.update(t); cupGroup.rotation.y += dt * (9 + 4 * Math.sin(t * 0.8)); vane.rotation.y = fr.yaw + windYaw + 0.16 * Math.sin(t * 1.3) + 0.07 * Math.sin(t * 3.1); });
  }

  // ── wind turbine (3 blades, spinning fast) ──
  {
    const x0 = TURB.x, z0 = TURB.z, H = TURB.h, g0 = gl(x0, z0);
    D.add(cyl(0.5, 0.58, 0.3, 14), { p: [x0, g0 + 0.1, z0], color: 0x59616a });
    M.add(cyl(0.065, 0.12, H, 12), { p: [x0, g0 + H / 2, z0], color: 0xe4eaee });
    M.add(cyl(0.13, 0.13, 0.14, 12), { p: [x0, g0 + H + 0.02, z0], color: 0x9aa2aa });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.6, ax = x0 + Math.sin(a) * 3.8, az = z0 + Math.cos(a) * 3.8, ag = gl(ax, az); M.add(strut([x0, g0 + H * 0.78, z0], [ax, ag + 0.08, az], 0.011), { uv: 0, color: 0x2a3036 }); D.add(box(0.36, 0.16, 0.36), { p: [ax, ag + 0.06, az], color: 0x5a626b }); }
    const nb = makeBatch(identityFrame(env));
    nb.add(rbox(0.34, 0.32, 0.9, 0.06), { p: [0, 0, -0.1], color: 0xe9eef2 }); nb.add(strut([0, 0.02, -0.5], [0, 0.04, -1.55], 0.022), { uv: 0, color: 0xcfd6dc });
    nb.add(box(0.025, 0.42, 0.5), { p: [0, 0.2, -1.6], color: 0xe8650f }); nb.add(cyl(0.02, 0.02, 0.2, 6), { p: [0, 0.15, 0.2], color: 0x2a3036 });
    const rb = makeBatch(identityFrame(env));
    rb.add(cyl(0.11, 0.14, 0.16, 14), { r: [Math.PI / 2, 0, 0], color: 0xe8650f }); rb.add(GM.Cone(0.115, 0.28, 14), { p: [0, 0, 0.2], r: [Math.PI / 2, 0, 0], color: 0xf2f4f6, uv: 0 });
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, bl = new THREE.CylinderGeometry(0.03, 0.12, 1.5, 4).rotateY(0.45);
      rb.add(bl, { p: [Math.sin(a) * 0.82, Math.cos(a) * 0.82, 0.02], r: [0, 0, -a], s: [1, 1, 0.3], color: 0xf1f4f6, uv: 0 });
    }
    const rotor = new THREE.Group(); rotor.add(rb.build(mat.spin));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), mat.blur); disc.position.z = 0.04; rotor.add(disc);
    rotor.position.set(0, 0, 0.42);
    const head = new THREE.Group(); head.add(nb.build(mat.paint), rotor); fr.place(head, x0, g0 + H + 0.2, z0, 0); group.add(head);
    let ang = 0;
    updaters.push((dt, t) => {
      const gust = 0.78 + 0.22 * Math.sin(t * 0.37 + 1.0) * Math.sin(t * 0.91) + 0.1 * Math.sin(t * 2.3);
      ang += dt * 13 * gust; rotor.rotation.z = ang; disc.material.opacity = 0.05 + 0.035 * gust;
      head.rotation.y = fr.yaw + windYaw + 0.11 * Math.sin(t * 0.6) + 0.05 * Math.sin(t * 2.1 + 1);
    });
    colliders.push(kit.cyl(fr.wx(x0, z0), fr.wz(x0, z0), 0.4, fr.y0 - 0.3, fr.y0 + H));
  }

  // ── lagged steam-sampling pipe + corrugated hose, stubbed toward vent #1 ──
  let flange = null;
  {
    const sx = hx1 + 0.02, sz = HUT.z - 0.2, yP = 0.42;
    const at = (s, y) => { const x = sx + 0.7 + vdir[0] * s, z = sz + vdir[1] * s; return [x, gl(x, z) + y, z]; };
    const run = [[sx, 1.0, sz], [sx + 0.45, 1.0, sz - 0.04], [sx + 0.7, 0.62, sz - 0.1], at(0.6, yP), at(2.2, yP), at(4.0, yP), at(5.8, yP), at(6.6, yP)];
    const lagMesh = new THREE.Mesh(tubeGeo(run, 0.145, 14, 90), mat.lag); mat.lag.map.repeat.set(7, 1); fr.place(lagMesh, 0, 0, 0); lagMesh.castShadow = lagMesh.receiveShadow = true; group.add(lagMesh);
    const hose = [[sx, 0.55, sz - 0.5], [sx + 0.5, 0.2, sz - 0.62], at(0.4, 0.07), at(1.4, 0.06), at(2.0, 0.065), at(3.1, 0.06), at(4.6, 0.065), at(5.8, 0.06)];
    for (let i = 2; i < hose.length; i++) { const o = 0.5 + 0.12 * Math.sin(i * 1.7); hose[i][0] += vnrm[0] * -o; hose[i][2] += vnrm[1] * -o; }   // the hose snakes on the leeward... back side of the lagged line
    const hoseMesh = new THREE.Mesh(tubeGeo(hose, 0.05, 8, 80), mat.hose); mat.hose.map.repeat.set(60, 1); fr.place(hoseMesh, 0, 0, 0); hoseMesh.castShadow = hoseMesh.receiveShadow = true; group.add(hoseMesh);
    M.add(tubeGeo([at(0.7, yP + 0.16), at(2.0, yP + 0.17), at(4.0, yP + 0.17), at(5.9, yP + 0.16)], 0.011, 5, 24), { uv: 0, color: 0xe8650f });       // heat-trace cable
    for (const s of [1.4, 3.1, 4.8]) {                                                                                                                  // sleeper supports
      const q = at(s, 0);
      for (const k of [-1, 1]) D.add(box(0.1, 0.34, 0.1), { p: [q[0] + vnrm[0] * k * 0.2, q[1] + 0.17, q[2] + vnrm[1] * k * 0.2], color: 0x3a4148 });
      M.add(box(0.55, 0.06, 0.1), { p: [q[0], q[1] + 0.3, q[2]], r: [0, vang, 0], color: 0xaab2ba });
    }
    const m = at(3.6, 0.95);                                                                                                                            // manifold box with gauges on a riser
    M.add(cyl(0.05, 0.05, 0.62, 8), { p: [m[0], m[1] - 0.4, m[2]], color: 0xb4bcc4 });
    P.add(rbox(0.34, 0.3, 0.48, 0.04), { p: m, r: [0, vang, 0], color: 0xe8650f });
    for (const k of [-0.13, 0.13]) G.add(GM.Circle(0.05, 14), { p: [m[0] + vnrm[0] * 0.175 + vdir[0] * k, m[1] + 0.03, m[2] + vnrm[1] * 0.175 + vdir[1] * k], r: [0, Math.atan2(vnrm[0], vnrm[1]), 0], color: [0.6, 2.8, 3.8], uv: 0 });
    const vv = at(5.3, yP + 0.14);                                                                                                                      // gate valve
    M.add(cyl(0.035, 0.035, 0.34, 8), { p: [vv[0], vv[1] + 0.2, vv[2]], color: 0xb4bcc4 }); M.add(GM.Torus(0.1, 0.014, 6, 16), { p: [vv[0], vv[1] + 0.38, vv[2]], r: [Math.PI / 2, 0, 0], color: 0xc2281c });
    const e = at(6.75, yP); flange = e;                                                                                                                 // capped flange at the stub end
    M.add(cyl(0.21, 0.21, 0.05, 20), { p: e, r: [Math.PI / 2, vang, 0], color: 0x9aa2aa });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, c = Math.cos(a) * 0.17, s = Math.sin(a) * 0.17; M.add(cyl(0.018, 0.018, 0.07, 6), { p: [e[0] + vnrm[0] * c + vdir[0] * 0.02, e[1] + s, e[2] + vnrm[1] * c + vdir[1] * 0.02], r: [Math.PI / 2, vang, 0], color: 0xc4cad0 }); }
    const tp = at(6.0, 0), tagYaw = Math.atan2(vnrm[0], vnrm[1]);                                                                                       // 'TO VENT 1' tag on a stake, arrow along the pipe
    M.add(cyl(0.012, 0.012, 0.8, 5), { p: [tp[0] + vnrm[0] * 0.45, tp[1] + 0.4, tp[2] + vnrm[1] * 0.45], color: 0xc4cad0 });
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), S({ map: kit.labelTexture(['TO VENT 1', `${ventDist} m  ▸`], { w: 256, h: 96, bg: '#d8e2e8', fg: '#1b2229', border: '#e8650f', borderW: 6, size: 28 }), roughness: 0.55 }));
    fr.place(tag, tp[0] + vnrm[0] * 0.47, tp[1] + 0.72, tp[2] + vnrm[1] * 0.47, tagYaw); tag.castShadow = false; group.add(tag);
    colliders.push(...obbBoxes(fr, (sx + 0.7 + e[0]) / 2, (sz + e[2]) / 2, Math.hypot(e[0] - sx - 0.7, e[2] - sz) / 2, 0.2, 0, 0.7, Math.atan2(-vdir[1], vdir[0]), 1.0));
  }

  // ── sample-bottle rack + insulated cooler, cable drums ──
  {
    const rx = 6.2, rz = 1.4, g0 = gl(rx, rz);
    for (const [sx, sz] of [[-0.8, -0.2], [0.8, -0.2], [-0.8, 0.2], [0.8, 0.2]]) M.add(cyl(0.025, 0.025, 1.45, 6), { p: [rx + sx, g0 + 0.72, rz + sz], color: 0xc4cad0 });
    for (const y of [0.35, 0.78, 1.2]) {
      M.add(box(1.7, 0.03, 0.5), { p: [rx, g0 + y, rz], color: 0xb4bcc4 });
      for (let i = 0; i < 7; i++) for (const dz of [-0.09, 0.1]) {
        const bx = rx - 0.72 + i * 0.24;
        BOT.add(cyl(0.05, 0.05, 0.2, 10), { p: [bx, g0 + y + 0.12, rz + dz], color: (i + (dz > 0 ? 1 : 0)) % 3 === 0 ? 0xbfe0f0 : 0xdcecf4, uv: 0 });
        BOT.add(cyl(0.052, 0.052, 0.04, 10), { p: [bx, g0 + y + 0.24, rz + dz], color: i % 2 && dz < 0 ? 0xe8650f : 0x20262b, uv: 0 });
      }
    }
    M.add(box(1.76, 0.04, 0.56), { p: [rx, g0 + 1.48, rz], color: 0xaab2ba });
    P.add(rbox(0.8, 0.42, 0.5, 0.05), { p: [rx + 0.2, g0 + 0.22, rz + 0.95], r: [0, 0.2, 0], color: 0xe8650f });
    colliders.push(...obbBoxes(fr, rx, rz, 0.9, 0.3, 0, 1.5), ...obbBoxes(fr, rx + 0.2, rz + 0.95, 0.4, 0.25, 0, 0.45, 0.2));
    const reel = (x, z, up, yaw) => {
      const g1 = gl(x, z), cy = g1 + (up ? 0.3 : 0.58), R = up ? [0, 0, 0] : [0, yaw, Math.PI / 2], ax = up ? [0, 1, 0] : [Math.cos(yaw), 0, -Math.sin(yaw)];
      for (const s of [-1, 1]) D.add(cyl(0.58, 0.58, 0.05, 20), { p: [x + ax[0] * 0.27 * s, cy + ax[1] * 0.27 * s, z + ax[2] * 0.27 * s], r: R, color: 0x59616b, uv: 0 });
      P.add(cyl(0.47, 0.47, 0.5, 20), { p: [x, cy, z], r: R, color: 0xe8650f, uv: 0 }); M.add(cyl(0.2, 0.2, 0.56, 12), { p: [x, cy, z], r: R, color: 0x8a929a, uv: 0 });
      colliders.push(kit.cyl(fr.wx(x, z), fr.wz(x, z), 0.62, fr.y0 - 0.3, fr.y0 + 1.2));
    };
    reel(5.3, -6.2, false, 0.5); reel(7.1, -4.9, true, 0);
  }

  // ── lifeline with pennant stakes toward the turbine (pennants flutter in the vertex shader) ──
  let flagU = null;
  {
    const path = [[1.7, 2.8], [-1.6, 3.3], [-4.9, 3.6], [-8.2, 3.2]], FL = 0.5, FH = 0.22, pos = [], aFl = [], aPh = [], idx = [];
    path.forEach(([x, z], i) => {
      const g0 = gl(x, z), top = g0 + 1.55;
      P.add(cyl(0.014, 0.018, 1.55, 6), { p: [x, g0 + 0.775, z], color: 0xe8650f, uv: 0 }); M.add(cyl(0.022, 0.022, 0.1, 6), { p: [x, top, z], color: 0xf2f4f6, uv: 0 });
      D.add(cyl(0.05, 0.07, 0.07, 8), { p: [x, g0 + 0.02, z], color: 0x30363c });
      const base = pos.length / 3;
      for (const [u, v] of [[0, 0], [0, -FH], [FL, -FH * 0.5]]) { const lx = x + wd[0] * u, lz = z + wd[1] * u; pos.push(fr.wx(lx, lz), fr.y0 + top - 0.08 + v, fr.wz(lx, lz)); aFl.push(u / FL); aPh.push(i * 1.9); }
      idx.push(base, base + 1, base + 2);
    });
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx); fg.computeVertexNormals();
    fg.setAttribute('aFl', new THREE.Float32BufferAttribute(aFl, 1)); fg.setAttribute('aPh', new THREE.Float32BufferAttribute(aPh, 1));
    const fm = S({ color: 0xe8650f, roughness: 0.8, side: THREE.DoubleSide }); flagU = { value: 0 };
    fm.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = flagU;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + flagGlsl.head).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + flagGlsl.body);
    };
    fm.customProgramCacheKey = () => 'wailFlag';
    const fmesh = new THREE.Mesh(fg, fm); fmesh.castShadow = false; fmesh.frustumCulled = false; group.add(fmesh);
    const rope = [];
    for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1]; for (let k = 0; k <= 4; k++) { const t = k / 4, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; rope.push([x, gl(x, z) + 1.5 - 0.22 * Math.sin(t * Math.PI), z]); } }
    D.add(tubeGeo(rope, 0.009, 4, 80), { uv: 0, color: 0xc2281c });
  }

  // ── snow drifts banked against the windward walls (soft geometry) ──
  {
    const up = [-wd[0], -wd[1]];                                                               // upwind unit [x, z]
    const drifts = [
      driftGeo(fr, { x: hx0 + 0.1, z: HUT.z + 0.2, dir: up, len: 7.4, wid: 4.8, h: 1.95, seed: 3 }),
      driftGeo(fr, { x: HUT.x - 1.4, z: HUT.z - HUT.W / 2 + 0.05, dir: [-0.3, -0.95], len: 4.6, wid: 3.2, h: 1.15, seed: 8 }),
      driftGeo(fr, { x: px - PORCH.w / 2 + 0.05, z: 1.0, dir: up, len: 3.6, wid: 2.2, h: 0.78, seed: 5 }),
      driftGeo(fr, { x: TOWER.x - 0.5, z: TOWER.z - 0.4, dir: up, len: 3.4, wid: 2.2, h: 0.42, seed: 11 }),
      driftGeo(fr, { x: 5.0, z: -5.4, dir: up, len: 3.0, wid: 2.4, h: 0.55, seed: 14 }),
    ];
    const sm = new THREE.Mesh(mergeAll(drifts), mat.snow); sm.receiveShadow = true; sm.castShadow = true; group.add(sm);
  }

  // ── icicles: porch eaves, window sills, pipe supports, tower platform, nacelle ──
  {
    const list = [], tg = gl(TOWER.x, TOWER.z), ug = gl(TURB.x, TURB.z);
    icicleRow([px - PORCH.w / 2 - 0.08, ph - 0.02, pz1 + 0.1], [px + PORCH.w / 2 + 0.08, ph - 0.02, pz1 + 0.1], 7, 0.1, 0.55, rng, list);
    icicleRow([px - PORCH.w / 2 - 0.08, ph - 0.02, 0.0], [px - PORCH.w / 2 - 0.08, ph - 0.02, pz1 + 0.1], 6, 0.1, 0.4, rng, list);
    for (const x of [-1.7, -0.2]) icicleRow([HUT.x + x - 0.4, 1.17, zf + 0.12], [HUT.x + x + 0.4, 1.17, zf + 0.12], 6, 0.05, 0.2, rng, list);
    icicleRow([TOWER.x - 0.9, tg + 5.52, TOWER.z + 1.0], [TOWER.x + 0.9, tg + 5.52, TOWER.z + 1.0], 5, 0.1, 0.45, rng, list);
    icicleRow([TURB.x - 0.17, ug + TURB.h + 0.04, TURB.z - 0.2], [TURB.x + 0.17, ug + TURB.h + 0.04, TURB.z - 0.2], 8, 0.08, 0.26, rng, list);
    for (const s of [1.4, 3.1, 4.8]) { const x = hx1 + 0.72 + vdir[0] * s, z = HUT.z - 0.2 + vdir[1] * s; icicleRow([x - 0.05, gl(x, z) + 0.58, z - 0.2], [x + 0.05, gl(x, z) + 0.58, z + 0.2], 6, 0.05, 0.16, rng, list); }
    addIcicles(ICE, list, rng);
  }

  // ── trampled snow / boot prints in front of the porch ──
  {
    const m = new THREE.Mesh(mergeAll([groundPatch(fr, px - 0.4, pz1 + 1.9, 5.2, 4.6, 0.15, 10, 10, 0.02)]), S({ map: bootsTexture(kit, { haze: true, seed: 21 }), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.receiveShadow = true; group.add(m);
  }

  // ── recorder in the porch doorway (log.cocytus.1) + warm porch light ──
  const rec = kit.recorder({ title: 'SURVEY B', sub: 'P. LIND', accent: '#ff9b3a', scale: 1.3 });
  fr.place(rec, px + 0.3, floorY + 0.79, 0.95, -0.4); group.add(rec);
  const lamp = kit.pointLight(0xffc888, 9, 11, [0, 0, 0]); lamp.position.copy(fr.pos(px, ph - 0.3, pz1 * 0.55)); group.add(lamp);

  // ── warm exhaust from the hut stack, a thin wisp where the sampling line ends ──
  const steam = steamPlume([{ p: fr.pos(HUT.x - 1.2, HUT.H + 1.0, HUT.z - 0.2), n: 22, rise: 3.4, spread: 0.4, size: 1.05 }, { p: fr.pos(flange[0], flange[1] + 0.25, flange[2]), n: 9, rise: 1.8, spread: 0.3, size: 0.7 }], WIND_TO, rng);
  group.add(steam.points);
  const vs = new THREE.Vector2(), R_ = env.ctx?.renderer; let vsT = 0;
  updaters.push((dt, t) => { vsT -= dt; if (vsT <= 0 && R_?.getDrawingBufferSize) { R_.getDrawingBufferSize(vs); vsT = 1; } steam.update(t, vs.y || 0); });

  // ── flush batches ──
  for (const [b, m] of [[P, mat.paint], [M, mat.metal], [D, mat.dark], [ICE, mat.ice], [BOT, mat.bottle]]) { const mesh = b.build(m, { cast: m !== mat.ice && m !== mat.bottle }); if (mesh) group.add(mesh); }
  const gm = G.build(mat.glow, { cast: false, receive: false }); if (gm) group.add(gm);

  colliders.push(...obbBoxes(fr, HUT.x, HUT.z, HUT.L / 2 + 0.1, HUT.W / 2, 0, HUT.H));
  colliders.push(...obbBoxes(fr, px - PORCH.w / 2 + 0.06, pz1 / 2, 0.07, pz1 / 2, 0, ph), ...obbBoxes(fr, px + PORCH.w / 2 - 0.06, pz1 / 2, 0.07, pz1 / 2, 0, ph),
    ...obbBoxes(fr, px - dw / 2 - jambW / 2, pz1 - 0.07, jambW / 2, 0.08, 0, ph), ...obbBoxes(fr, px + dw / 2 + jambW / 2, pz1 - 0.07, jambW / 2, 0.08, 0, ph));       // porch: side walls + jambs; the doorway stays open

  updaters.push((dt, t) => { rec.userData.ledUpdate(t); flagU.value = t; });
  const interactables = [
    kit.interactable({ id: 'poi.world.cocytus.poi.geyser', label: 'Inspect geyser monitor station', pos: fr.pos(0.2, 1.3, 0.9), radius: 4.2, object: group, lineId: 'world.cocytus.poi.geyser' }),
    kit.interactable({ id: 'log.cocytus.1', label: 'Play field recorder', pos: fr.pos(px + 0.3, 1.15, 1.0), radius: 2.7, object: rec, lineId: 'log.cocytus.1', log: true }),
  ];
  return { group, interactables, colliders, update(dt, t, camPos) { for (const u of updaters) u(dt, t, camPos); } };
}
