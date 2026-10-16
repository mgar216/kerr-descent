// ORPHEUS · Charon / Ferryman's Crater (slot `marker`, padR 4.5) — the survey marker: a slender anodised/stainless pylon with an orange survey band,
// a solar-powered beacon on top, an engraved plate, a cairn of angular ice-rock with reflective stakes, a surveyor's tripod instrument, boot prints.
// Airless / windless: the survey flag is rigid (frozen wrinkles on a horizontal spar), nothing sways.
import * as THREE from 'three';
import { GM, makeFrame, makeBatch, paintTexture, brushedTexture, bootsTexture, rbox, rockGeo, strut, tubeGeo, lathe, groundPatch, mergeAll } from './poi_charon_icekit.js';

const CYL = (rt, rb, h, seg = 12) => GM.Cylinder(rt, rb, h, seg);
const flat = (g) => { const f = g.toNonIndexed(); f.computeVertexNormals(); return f; };

function plateTexture(kit) {
  return kit.canvasTexture(512, 256, (g, W, H) => {
    const r = kit.mulberry32(31);
    g.fillStyle = '#b9bec4'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 420; i++) { g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${0.04 + r() * 0.1})` : `rgba(0,0,0,${0.03 + r() * 0.08})`; g.fillRect(0, r() * H, W, 0.6 + r() * 1.4); }
    g.strokeStyle = 'rgba(40,44,50,0.7)'; g.lineWidth = 4; g.strokeRect(10, 10, W - 20, H - 20); g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.5; g.strokeRect(15, 15, W - 30, H - 30);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const line = (s, y, px, w, ls) => {
      g.font = `${w} ${px}px "Trajan Pro", "Palatino Linotype", Georgia, serif`; try { g.letterSpacing = ls + 'px'; } catch { /* optional */ }
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillText(s, W / 2 + 1.4, y + 1.6); g.fillStyle = '#23272d'; g.fillText(s, W / 2, y);
      try { g.letterSpacing = '0px'; } catch { /* optional */ }
    };
    line("FERRYMAN'S CRATER", 78, 44, 700, 3); line('SURVEY STATION', 136, 36, 600, 5);
    g.fillStyle = 'rgba(35,39,45,0.7)'; g.fillRect(70, 168, W - 140, 2);
    line('HALCYON SURVEY DIRECTORATE · DATUM BM-02', 200, 17, 600, 1.5);
    for (const [x, y] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) { g.fillStyle = '#6a6f76'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.strokeStyle = '#2a2e33'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.stroke(); }
  }, { wrap: false, aniso: 8 });
}

function flagTexture(kit) {
  return kit.canvasTexture(128, 80, (g, W, H) => {
    g.fillStyle = '#e8650f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f4f1ea'; g.fillRect(0, H * 0.42, W, H * 0.16);
    g.fillStyle = '#17191c'; g.font = '700 15px Rajdhani, "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SURVEY', W / 2, H * 0.5);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 6; i++) g.fillRect(0, i * 14 + 6, W, 2);
    kit.grime(g, W, H, { amount: 0.4, seed: 4, color: 'rgba(30,20,10,0.2)' });
  }, { wrap: false, aniso: 4 });
}

export function buildFerryman(env, slot) {
  const { kit } = env, fr = makeFrame(env, slot), group = new THREE.Group(); group.name = 'ferryman';
  const rng = kit.rng('ferryman'), colliders = [], updaters = [];
  const S = (o) => kit.std({ color: 0xffffff, ...o });
  const mat = {
    paint: S({ map: paintTexture(kit, { w: 256, h: 256, base: '#d4d7d9', cols: 2, rows: 2, seed: 29, grimeAmt: 0.5, pits: 0.4 }), vertexColors: true, roughness: 0.6, metalness: 0.1 }),
    metal: S({ map: brushedTexture(kit, { dir: 'v', base: '#cdd2d7' }), vertexColors: true, roughness: 0.32, metalness: 0.65 }),
    dark: S({ vertexColors: true, roughness: 0.8, metalness: 0.1 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
    rock: S({ vertexColors: true, roughness: 0.74, metalness: 0.0 }),
  };
  const P = makeBatch(fr), M = makeBatch(fr), D = makeBatch(fr), G = makeBatch(fr), R = makeBatch(fr);

  // ── footing, benchmark, plinth ──
  P.add(lathe([[0, -0.25], [0.68, -0.25], [0.68, 0.06], [0.62, 0.13], [0, 0.13]], 28), { color: 0x8a8e94, dirt: 0.15 });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; M.add(CYL(0.04, 0.04, 0.045, 6), { p: [Math.sin(a) * 0.5, 0.15, Math.cos(a) * 0.5], color: 0xb4bac0 }); }
  M.add(CYL(0.085, 0.085, 0.014, 22), { p: [0.18, 0.138, 0.5], color: 0xc99a46 });
  M.add(GM.Torus(0.05, 0.004, 5, 20), { p: [0.18, 0.146, 0.5], r: [Math.PI / 2, 0, 0], color: 0x6c5420 });
  M.add(rbox(0.52, 0.9, 0.52, 0.03), { p: [0, 0.13 + 0.45, 0], color: 0x565b61 });
  M.add(rbox(0.58, 0.06, 0.58, 0.02), { p: [0, 1.06, 0], color: 0x9aa0a6 });
  for (const sx of [-0.15, 0.15]) for (const sy of [1.25, 1.39]) M.add(CYL(0.008, 0.008, 0.07, 6), { p: [sx, sy, 0.17], r: [Math.PI / 2, 0, 0], color: 0x9aa0a6 });
  M.add(rbox(0.44, 0.24, 0.02, 0.006), { p: [0, 1.32, 0.205], color: 0x4a4e54 });

  // ── shaft (octagonal, tapered), orange survey bands, collar, solar crown, radio box, whip antenna ──
  const rS = (y) => 0.152 - (y - 1.09) / 2.3 * 0.057;                                   // shaft radius at height y
  const ring = (y0, y1, dr, color, mat_) => mat_.add(flat(CYL(rS(y1) + dr, rS(y0) + dr, y1 - y0, 8)), { p: [0, (y0 + y1) / 2, 0], color, uv: 0 });
  M.add(flat(CYL(0.095, 0.152, 2.3, 8)), { p: [0, 1.09 + 1.15, 0], uv: 0, uvS: [2, 2], color: 0xf1f4f6 });
  ring(2.02, 2.54, 0.014, 0xf06a10, P);                                                   // survey band (fluorescent orange)
  ring(1.985, 2.02, 0.017, 0xf4f6f7, M); ring(2.54, 2.575, 0.017, 0xf4f6f7, M);          // reflective tape either side
  ring(1.55, 1.64, 0.013, 0xf4f6f7, P); ring(1.46, 1.55, 0.013, 0xf06a10, P);
  M.add(CYL(0.12, 0.1, 0.09, 8), { p: [0, 3.4, 0], color: 0x8e949a });
  P.add(flat(CYL(0.34, 0.16, 0.2, 6)), { p: [0, 3.52, 0], color: 0x233267, uv: 0.8 });
  M.add(CYL(0.035, 0.05, 0.22, 8), { p: [0, 3.72, 0], color: 0xb4bac0 });
  M.add(rbox(0.16, 0.12, 0.1, 0.02), { p: [0.0, 3.1, 0.17], color: 0xdadde0 });
  G.add(GM.Plane(0.02, 0.02), { p: [0.05, 3.12, 0.222], color: [0.4, 5.5, 1.0], uv: 0 });
  M.add(CYL(0.006, 0.008, 0.75, 5), { p: [-0.17, 3.35, 0.0], color: 0xc4cad0 });
  for (const [y, s] of [[2.8, 1], [1.9, -1]]) M.add(rbox(0.08, 0.05, 0.08, 0.01), { p: [s * 0.13, y, 0.1], color: 0x7c828a });

  // ── cairn of angular ice-rock + loose stones ──
  const ice = [0xaebdc9, 0xc3cfd8, 0x9fb0be, 0xb7c4cf], rockc = [0x7b7a78, 0x8a8782, 0x6c6d70], dust = [0x8b8274, 0x7d766a];
  const pick = () => { const q = rng(); return q < 0.6 ? ice[(rng() * ice.length) | 0] : q < 0.85 ? rockc[(rng() * rockc.length) | 0] : dust[(rng() * dust.length) | 0]; };
  let seed = 1;
  for (let layer = 0; layer < 4; layer++) {
    const n = 12 - layer * 2, rad = 1.3 - layer * 0.26, y = 0.12 + layer * 0.19, sz = 0.36 - layer * 0.05;
    for (let i = 0; i < n; i++) {
      const a = (i + rng() * 0.6) / n * Math.PI * 2, rr = rad + (rng() - 0.5) * 0.25, s = sz * (0.7 + rng() * 0.6);
      R.add(rockGeo(seed++, s * (1 + rng() * 0.5), s * (0.8 + rng() * 0.45), s * (0.9 + rng() * 0.45), { detail: 2, rough: 0.3 }), { p: [Math.sin(a) * rr, y + s * 0.2, Math.cos(a) * rr], r: [(rng() - 0.5) * 0.5, rng() * 6.28, (rng() - 0.5) * 0.5], color: pick(), uv: 0, vcol: true });
    }
  }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; R.add(rockGeo(seed++, 0.22, 0.2, 0.22, { detail: 2, rough: 0.3 }), { p: [Math.sin(a) * 0.4, 0.78 + (i % 2) * 0.06, Math.cos(a) * 0.4], r: [0, rng() * 6, 0], color: pick(), uv: 0, vcol: true }); }
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2, rr = 1.7 + rng() * 2.4, x = Math.sin(a) * rr, z = Math.cos(a) * rr, s = 0.06 + rng() * 0.17;
    R.add(rockGeo(seed++, s * 1.2, s * 0.7, s, { detail: 1, rough: 0.3 }), { p: [x, fr.gy(x, z) - fr.y0 + s * 0.1, z], r: [0, rng() * 6, 0], color: pick(), uv: 0, vcol: true });
  }

  // ── reflective stakes (orange fibreglass, silver tape cap) ──
  [[2.1, 0.5], [1.4, -2.2], [-1.8, -2.0], [-2.6, 0.2], [-1.2, 2.2], [0.9, 2.5]].forEach(([x, z], i) => {
    const h = 1.25 + (i % 3) * 0.22, gy = fr.gy(x, z) - fr.y0, lean = 0.05 * (i % 2 ? 1 : -1);
    P.add(CYL(0.011, 0.014, h, 6), { p: [x, gy + h / 2, z], r: [lean, 0, -lean * 0.6], color: 0xe8650f, uv: 0 });
    M.add(CYL(0.0125, 0.0125, 0.2, 6), { p: [x - lean * 0.6 * h * 0.5, gy + h - 0.1, z + lean * h * 0.5], r: [lean, 0, -lean * 0.6], color: 0xf6f8fa, uv: 0 });
    D.add(CYL(0.03, 0.04, 0.05, 8), { p: [x, gy + 0.02, z], color: 0x3a3d42 });
    G.add(GM.Sphere(0.016, 8, 6), { p: [x - lean * 0.6 * h, gy + h + 0.015, z + lean * h], color: [3.4, 1.55, 0.35], uv: 0 });
  });

  // ── surveyor's total station on a tripod ──
  {
    const tx = 2.05, tz = 1.0, ty = 1.42, legs = [0.3, 2.4, 4.5].map((a) => [tx + Math.sin(a) * 0.78, tz + Math.cos(a) * 0.78]);
    for (const [lx, lz] of legs) {
      const gy = fr.gy(lx, lz) - fr.y0;
      M.add(strut([tx, ty - 0.05, tz], [lx, gy + 0.02, lz], 0.021, 0.013), { color: 0xd6dade, uv: 0 });
      M.add(rbox(0.05, 0.12, 0.05, 0.01), { p: [tx + (lx - tx) * 0.62, ty - 0.05 + (gy + 0.02 - ty + 0.05) * 0.62 + 0.02, tz + (lz - tz) * 0.62], color: 0x2c3036 });
      D.add(CYL(0.012, 0.02, 0.05, 6), { p: [lx, gy + 0.025, lz], color: 0x24272b });
    }
    M.add(CYL(0.1, 0.1, 0.035, 18), { p: [tx, ty, tz], color: 0x9aa0a6 });
    D.add(CYL(0.065, 0.075, 0.04, 14), { p: [tx, ty + 0.035, tz], color: 0x2c3036 });
    P.add(rbox(0.2, 0.17, 0.17, 0.03), { p: [tx, ty + 0.15, tz], color: 0xe8eaeb });
    P.add(rbox(0.2, 0.04, 0.17, 0.015), { p: [tx, ty + 0.13, tz], color: 0xe8650f });
    for (const s of [-1, 1]) P.add(rbox(0.04, 0.22, 0.13, 0.015), { p: [tx + s * 0.11, ty + 0.34, tz], color: 0xe8eaeb });
    M.add(CYL(0.038, 0.038, 0.24, 14), { p: [tx, ty + 0.34, tz], r: [Math.PI / 2, 0, 0], color: 0x9aa0a6 });
    D.add(CYL(0.032, 0.032, 0.02, 14), { p: [tx, ty + 0.34, tz + 0.125], r: [Math.PI / 2, 0, 0], color: 0x0c1016 });
    M.add(GM.Torus(0.085, 0.01, 5, 14, Math.PI), { p: [tx, ty + 0.46, tz], r: [0, Math.PI / 2, 0], color: 0xe8650f });
    G.add(GM.Plane(0.08, 0.05), { p: [tx + 0.1, ty + 0.17, tz + 0.087], color: [0.5, 2.6, 3.6], uv: 0 });
    M.add(tubeGeo([[tx, ty - 0.02, tz], [tx, ty * 0.5, tz], [tx, 0.08, tz]], 0.003, 4, 6), { color: 0x23262a, uv: 0 });
    M.add(new THREE.ConeGeometry(0.018, 0.05, 8).rotateX(Math.PI), { p: [tx, 0.06, tz], color: 0xc99a46 });
    colliders.push(kit.cyl(fr.wx(tx, tz), fr.wz(tx, tz), 0.5, fr.y0, fr.y0 + 1.8));
    // prism pole with bands, on a bipod
    const px = -2.3, pz = -0.8, pg = fr.gy(px, pz) - fr.y0;
    for (let i = 0; i < 10; i++) P.add(CYL(0.016, 0.016, 0.2, 8), { p: [px, pg + 0.1 + i * 0.2, pz], color: i % 2 ? 0xf2f4f5 : 0xe8650f, uv: 0 });
    D.add(CYL(0.06, 0.06, 0.12, 6), { p: [px, pg + 2.1, pz], color: 0x1a2650 });
    M.add(GM.Torus(0.065, 0.007, 5, 16), { p: [px, pg + 2.1, pz], r: [Math.PI / 2, 0, 0], color: 0xc4cad0 });
    for (const s of [-1, 1]) M.add(strut([px, pg + 1.3, pz], [px + s * 0.42, pg + 0.01, pz + 0.3 * s], 0.012), { color: 0xaeb4ba, uv: 0 });
    colliders.push(kit.cyl(fr.wx(px, pz), fr.wz(px, pz), 0.12, fr.y0, fr.y0 + 2.3));
  }

  // ── rigid survey flag (spar keeps it unfurled; wrinkles frozen) ──
  {
    const fx = -3.0, fz = 1.4, fg = fr.gy(fx, fz) - fr.y0;
    M.add(CYL(0.01, 0.012, 1.3, 6), { p: [fx, fg + 0.65, fz], color: 0xdadde0, uv: 0 });
    M.add(CYL(0.006, 0.006, 0.55, 5), { p: [fx + 0.27, fg + 1.28, fz], r: [0, 0, Math.PI / 2], color: 0xdadde0, uv: 0 });
    M.add(GM.Sphere(0.02, 8, 6), { p: [fx, fg + 1.32, fz], color: 0xe8b21a });
    const cg = new THREE.PlaneGeometry(0.5, 0.32, 14, 8), cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) { const u = (cp.getX(i) + 0.25) / 0.5, v = (cp.getY(i) + 0.16) / 0.32; cp.setZ(i, 0.035 * Math.sin(u * 9 + v * 3) * (0.25 + u) + 0.02 * Math.sin(v * 12 + u * 2) + u * 0.02); }
    cg.computeVertexNormals();
    const cloth = new THREE.Mesh(cg, S({ map: flagTexture(kit), side: THREE.DoubleSide, roughness: 0.9 })); cloth.castShadow = true; cloth.receiveShadow = true;
    fr.place(cloth, fx + 0.29, fg + 1.12, fz, 0); group.add(cloth);
  }

  // ── boot-print / disturbed-regolith decal in front of the marker ──
  {
    const m = new THREE.Mesh(mergeAll([groundPatch(fr, 0.1, 1.0, 5.6, 5.6, 0.25, 10, 10, 0.02)]), S({ map: bootsTexture(kit, { haze: true }), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.receiveShadow = true; group.add(m);
  }

  // ── engraved plate (facing the ship) ──
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), S({ map: plateTexture(kit), roughness: 0.38, metalness: 0.55 }));
  fr.place(plate, 0, 1.32, 0.218); plate.castShadow = false; group.add(plate);
  {
    const glowTex = kit.canvasTexture(512, 256, (g, W, H) => {
      g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,214,150,0.9)'; g.shadowColor = 'rgba(255,190,110,0.9)'; g.shadowBlur = 6;
      for (const [t, y, px, w, ls] of [["FERRYMAN'S CRATER", 78, 44, 700, 3], ['SURVEY STATION', 136, 36, 600, 5]]) { g.font = `${w} ${px}px "Trajan Pro", "Palatino Linotype", Georgia, serif`; try { g.letterSpacing = ls + 'px'; } catch { /* optional */ } g.fillText(t, W / 2, y); }
    }, { wrap: false, aniso: 8 });
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(0.9, 0.9, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    fr.place(gp, 0, 1.32, 0.222); gp.castShadow = false; gp.renderOrder = 3; group.add(gp);
  }

  // ── recorder at the cairn (log.charon.2) ──
  const rec = kit.recorder({ title: 'SURVEY B', sub: 'P. LIND', accent: '#ff9b3a', scale: 1.3 });
  fr.place(rec, -1.25, 0.78, 1.25, 0.5); group.add(rec);

  // ── beacon on the pylon head ──
  const beacon = kit.beacon(fr.pos(0, 3.86, 0).toArray(), { color: 0xff7a30, size: 0.075, range: 24, lightI: 14, period: 2.1, duty: 0.14 });
  group.add(beacon.group);

  // ── flush ──
  for (const [b, m] of [[P, mat.paint], [M, mat.metal], [D, mat.dark], [R, mat.rock]]) { const mesh = b.build(m); if (mesh) group.add(mesh); }
  const gm = G.build(mat.glow, { cast: false, receive: false }); if (gm) group.add(gm);

  colliders.push(kit.cyl(fr.wx(0, 0), fr.wz(0, 0), 0.3, fr.y0, fr.y0 + 3.8), kit.cyl(fr.wx(0, 0), fr.wz(0, 0), 1.15, fr.y0 - 0.3, fr.y0 + 0.85));

  const interactables = [
    kit.interactable({ id: 'poi.world.charon.poi.marker', label: "Inspect Ferryman's survey marker", pos: fr.pos(0, 1.3, 1.0), radius: 3.1, object: plate, lineId: 'world.charon.poi.marker' }),
    kit.interactable({ id: 'log.charon.2', label: 'Play field recorder', pos: fr.pos(-1.25, 1.1, 1.25), radius: 2.6, object: rec, lineId: 'log.charon.2', log: true }),
  ];
  return { group, interactables, colliders, update(dt, t) { beacon.update(t); rec.userData.ledUpdate(t); } };
}
