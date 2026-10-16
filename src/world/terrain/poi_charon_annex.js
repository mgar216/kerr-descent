// ORPHEUS · Sentinel Observatory — control annex (foil-wrapped roof, radiators, lit windows, airlock alcove with the field recorder),
// dome corridor, propellant tanks and the outdoor viewing kiosk with the long-exposure ghost screen.
import * as THREE from 'three';
import { GM, rbox, strut, tubeGeo, obbBoxes } from './poi_charon_icekit.js';
import { DOME } from './poi_charon_dome.js';
import { makeGhostScreen } from './poi_charon_screen.js';

export const ANNEX = { x: 11.5, z: -4.2, hx: 6.3, hz: 2.7 };
export const KIOSK = { x: 16.1, z: 2.0 };

const box = GM.Box;
const WARM = (k) => [3.0 * k, 1.72 * k, 0.68 * k];

export function buildAnnex(B, dc) {
  const { fr, kit, bat, env } = B, { P, M, D, G, H, F, RAD } = bat;
  const A = ANNEX, ax = A.x, az = A.z, zf = az + 2.65;           // zf: front facade plane

  // ── foundation slab, skirt, wall blocks (alcove cut-out at x = +1.8) ──
  P.add(rbox(13.5, 0.55, 6.3, 0.06), { p: [ax, -0.075, az], color: 0x84888e, dirt: 0.25 });
  D.add(box(12.7, 0.5, 5.5), { p: [ax, 0.45, az], color: 0x4b4f55 });
  const wall = (w, h, d, x, y, z, color = 0xe5e7e8) => P.add(box(w, h, d), { p: [ax + x, y, az + z], color, dirt: 0.5, dirtH: 1.5 });
  wall(12.5, 2.4, 3.8, 0, 1.9, -0.75);
  wall(7.1, 2.4, 1.5, -2.7, 1.9, 1.9);
  wall(3.5, 2.4, 1.5, 4.5, 1.9, 1.9);
  wall(1.9, 0.65, 1.5, 1.8, 2.775, 1.9);
  // MLI thermal-blanket cladding band around the module base, held by dark straps
  for (const [w, d, x, z] of [[12.5, 3.8, 0, -0.75], [7.1, 1.5, -2.7, 1.9], [3.5, 1.5, 4.5, 1.9]]) {
    F.add(box(w + 0.1, 0.74, d + 0.1), { p: [ax + x, 0.92, az + z], uv: 0.5 });
    D.add(box(w + 0.14, 0.05, d + 0.14), { p: [ax + x, 1.3, az + z], color: 0x30343a });
    D.add(box(w + 0.14, 0.05, d + 0.14), { p: [ax + x, 0.57, az + z], color: 0x30343a });
  }
  for (let sx = -5.6; sx <= 5.6; sx += 1.4) { if (sx > 0.7 && sx < 2.9) continue; D.add(box(0.07, 0.78, 0.02), { p: [ax + sx, 0.92, zf + 0.055], color: 0x30343a }); }
  for (const sz of [-1.9, -0.3, 1.3]) for (const sx of [-6.31, 6.31]) D.add(box(0.02, 0.78, 0.07), { p: [ax + sx, 0.92, az + sz], color: 0x30343a });
  P.add(box(12.7, 0.22, 5.5), { p: [ax, 3.2, az], color: 0xd2d6d9 });
  for (const [w, x] of [[7.12, -2.7], [3.52, 4.5]]) P.add(box(w, 0.14, 0.03), { p: [ax + x, 2.8, zf + 0.012], color: 0xe36a14, uv: 0 });
  for (const s of [-1, 1]) P.add(box(0.03, 0.14, 5.4), { p: [ax + s * 6.265, 2.8, az], color: 0xe36a14, uv: 0 });

  // ── roof: MLI foil blanket, parapet, HVAC, vent stack, radiators on stand-offs, sensor mast ──
  F.add(box(12.2, 0.12, 5.0), { p: [ax, 3.37, az], uv: 0.5 });
  for (const [w, d, x, z] of [[12.6, 0.1, 0, 2.62], [12.6, 0.1, 0, -2.62], [0.1, 5.3, -6.22, 0], [0.1, 5.3, 6.22, 0]]) P.add(box(w, 0.3, d), { p: [ax + x, 3.46, az + z], color: 0xd8dbdd });
  P.add(rbox(1.7, 0.85, 1.3, 0.06), { p: [ax - 4.3, 3.86, az - 0.4], color: 0xdadddf });
  D.add(box(1.25, 0.5, 0.03), { p: [ax - 4.3, 3.84, az + 0.26], color: 0x2c3035 });
  D.add(GM.Cylinder(0.46, 0.46, 0.04, 22), { p: [ax - 4.3, 4.3, az - 0.4], color: 0x2c3035 });
  M.add(GM.Cylinder(0.06, 0.06, 0.08, 10), { p: [ax - 4.3, 4.34, az - 0.4], color: 0xb4bac0 });
  M.add(GM.Cylinder(0.16, 0.16, 1.1, 14), { p: [ax + 4.9, 4.0, az - 1.4], color: 0xc4cad0 });
  M.add(GM.Cylinder(0.0, 0.3, 0.22, 14), { p: [ax + 4.9, 4.66, az - 1.4], color: 0x8e949a });
  for (const [rx, k] of [[-2.0, 0], [2.3, 1]]) {
    const x = ax + rx, y = 5.02, z = az - 2.0;
    RAD.add(box(4.0, 1.7, 0.07), { p: [x, y, z], uv: 0 });
    for (const dy of [-0.88, 0.88]) M.add(box(4.1, 0.06, 0.13), { p: [x, y + dy, z], color: 0xc6ccd2 });
    for (const dx of [-2.03, 2.03]) M.add(box(0.06, 1.82, 0.13), { p: [x + dx, y, z], color: 0xc6ccd2 });
    for (const dx of [-1.7, 1.7]) for (const dz of [-0.35, 0.35]) M.add(strut([x + dx, 3.43, z + dz], [x + dx, y - 0.86, z + dz * 0.2], 0.035), { uv: 0, color: 0xaeb4ba });
    M.add(tubeGeo([[x - 0.9, 3.43, z + 0.35], [x - 0.9, 3.9, z + 0.35], [x - 0.9, y - 0.86, z + 0.04]], 0.07, 8), { uv: 0, color: 0xdadde0 });
    M.add(tubeGeo([[x + 0.9, 3.43, z + 0.35], [x + 0.9, 3.9, z + 0.35], [x + 0.9, y - 0.86, z + 0.04]], 0.07, 8), { uv: 0, color: 0xdadde0 });
    G.add(box(0.05, 0.05, 0.05), { p: [x + 1.95, y + 0.9, z + 0.08], color: [0.5, 3 + k * 1.5, 5] });
  }
  M.add(GM.Cylinder(0.03, 0.04, 2.4, 8), { p: [ax + 1.4, 4.7, az - 1.6], color: 0xc4cad0 });
  P.add(rbox(0.3, 0.2, 0.2, 0.03), { p: [ax + 1.4, 5.6, az - 1.6], color: 0xdadddf });
  M.add(GM.Sphere(0.12, 10, 8), { p: [ax + 1.4, 5.85, az - 1.6], color: 0xc4cad0 });

  // ── windows (lit) with blinds, front ──
  for (const [wx, k, blinds] of [[-5.0, 1.0, 3], [-3.1, 0.75, 6], [-1.2, 1.15, 1]]) {
    const x = ax + wx;
    D.add(rbox(1.46, 0.92, 0.1, 0.03), { p: [x, 1.95, zf + 0.02], color: 0x2d3137 });
    G.add(GM.Plane(1.22, 0.68), { p: [x, 1.95, zf + 0.076], color: WARM(k), uv: 0 });
    D.add(box(0.04, 0.68, 0.03), { p: [x, 1.95, zf + 0.086], color: 0x25292e });
    for (let s = 0; s < blinds; s++) D.add(box(1.22, 0.035, 0.025), { p: [x, 1.95 + 0.31 - s * 0.085, zf + 0.09], color: 0x3c4046 });
    M.add(box(1.52, 0.05, 0.18), { p: [x, 1.46, zf + 0.08], color: 0xaab0b6 });
  }
  {
    const x = ax + 4.5;
    D.add(rbox(2.5, 1.02, 0.1, 0.03), { p: [x, 1.9, zf + 0.02], color: 0x2d3137 });
    G.add(GM.Plane(2.26, 0.78), { p: [x, 1.9, zf + 0.076], color: [0.85, 1.9, 3.2], uv: 0 });
    for (const m of [-0.75, 0, 0.75]) D.add(box(0.04, 0.78, 0.03), { p: [x + m, 1.9, zf + 0.086], color: 0x25292e });
    M.add(box(2.58, 0.05, 0.18), { p: [x, 1.36, zf + 0.08], color: 0xaab0b6 });
  }
  // floodlights over the corners, conduit runs, junction box
  for (const s of [-1, 1]) {
    D.add(rbox(0.36, 0.22, 0.3, 0.04), { p: [ax + s * 5.8, 2.98, zf + 0.15], color: 0x3a3e44 });
    G.add(GM.Plane(0.28, 0.15), { p: [ax + s * 5.8, 2.95, zf + 0.305], color: [10, 9, 7], uv: 0 });
    M.add(strut([ax + s * 5.8, 2.9, zf + 0.04], [ax + s * 5.8, 0.75, zf + 0.04], 0.03), { uv: 0, color: 0x8e949a });
  }
  D.add(rbox(0.6, 0.8, 0.22, 0.03), { p: [ax + 6.0, 1.3, zf + 0.12], color: 0x3a3e44 });
  G.add(box(0.05, 0.05, 0.02), { p: [ax + 5.85, 1.5, zf + 0.235], color: [0.5, 5, 1.2] });
  B.sign(new THREE.PlaneGeometry(0.34, 0.34), 'hv', { p: [ax + 6.0, 1.05, zf + 0.236], uv: 0 });

  // ── airlock alcove (x = +1.8): floor, hazard-framed door, ceiling light, extinguisher, scraper mat ──
  const dx = ax + 1.8, dz = az + 1.15;
  D.add(box(1.9, 0.06, 1.5), { p: [dx, 0.23, az + 1.9], color: 0x34383e });
  D.add(box(1.5, 0.03, 0.7), { p: [dx, 0.275, az + 2.28], color: 0x24272b });
  P.add(rbox(1.5, 2.1, 0.12, 0.03), { p: [dx, 0.26 + 1.05, dz + 0.08], color: 0xdcdfe1, uv: 0.5 });
  P.add(box(0.2, 2.0, 0.012), { p: [dx - 0.45, 0.26 + 1.05, dz + 0.146], color: 0xe36a14, uv: 0 });
  for (const s of [-1, 1]) H.add(box(2.2, 0.11, 0.07), { p: [dx + s * 0.86, 0.26 + 1.1, dz + 0.1], r: [0, 0, Math.PI / 2], uv: 0, uvS: [0.9, 1] });
  H.add(box(1.82, 0.11, 0.07), { p: [dx, 0.26 + 2.2, dz + 0.1], uv: 0, uvS: [0.75, 1] });
  M.add(GM.Torus(0.13, 0.016, 6, 18), { p: [dx + 0.45, 1.3, dz + 0.17], color: 0xc4cad0 });
  for (let i = 0; i < 3; i++) M.add(box(0.26, 0.016, 0.016), { p: [dx + 0.45, 1.3, dz + 0.17], r: [0, 0, i * Math.PI / 3], color: 0xc4cad0 });
  G.add(GM.Circle(0.12, 18), { p: [dx - 0.3, 1.82, dz + 0.146], color: [1.6, 2.3, 3.0], uv: 0 });
  M.add(GM.Torus(0.13, 0.02, 6, 20), { p: [dx - 0.3, 1.82, dz + 0.146], color: 0xaab0b6 });
  D.add(rbox(0.16, 0.26, 0.05, 0.015), { p: [dx + 0.98, 1.35, dz + 0.1], color: 0x2c3036 });
  G.add(GM.Plane(0.06, 0.04), { p: [dx + 0.98, 1.42, dz + 0.127], color: [0.5, 5.5, 1.2] });
  G.add(GM.Plane(0.06, 0.04), { p: [dx + 0.98, 1.3, dz + 0.127], color: [5.5, 0.9, 0.5] });
  G.add(GM.Plane(1.5, 0.28), { p: [dx, 2.42, az + 1.9], r: [Math.PI / 2, 0, 0], color: [8.5, 7.4, 5.6], uv: 0 });
  P.add(GM.Cylinder(0.075, 0.075, 0.5, 12), { p: [dx + 0.82, 0.6, az + 2.3], color: 0xc2281c });
  D.add(GM.Cylinder(0.03, 0.03, 0.08, 8), { p: [dx + 0.82, 0.88, az + 2.3], color: 0x1c1e22 });
  B.sign(new THREE.PlaneGeometry(0.56, 0.22), 'airlock', { p: [dx, 2.78, zf + 0.012], uv: 0 });

  // ── dome corridor ──
  const zc = az - 2.0, xDrum = dc.x + Math.sqrt(DOME.DR * DOME.DR - (zc - dc.z) ** 2), x1 = xDrum - 0.35, x2 = ax - 6.25 + 0.3, L = x2 - x1, xm = (x1 + x2) / 2;
  P.add(GM.Cylinder(1.0, 1.0, L, 28, 1, true), { p: [xm, 1.4, zc], r: [0, 0, Math.PI / 2], uv: 0, uvS: [Math.PI * 0.5, L * 0.5], color: 0xe3e5e6, dirt: 0.3 });
  for (let x = x1 + 0.55; x < x2 - 0.2; x += 0.7) M.add(GM.Torus(1.02, 0.035, 6, 28), { p: [x, 1.4, zc], r: [0, Math.PI / 2, 0], color: 0xc2c8ce });
  for (const x of [x1 + 0.6, x2 - 0.6]) { D.add(box(0.34, 0.5, 1.9), { p: [x, 0.45, zc], color: 0x44484e }); }
  for (const x of [x1 + 0.7, x2 - 0.7]) F.add(GM.Cylinder(1.045, 1.045, 0.7, 28, 1, true), { p: [x, 1.4, zc], r: [0, 0, Math.PI / 2], uv: 0, uvS: [3.3, 0.7] });
  for (const x of [xm - 0.9, xm + 0.9]) { M.add(GM.Cylinder(0.15, 0.15, 0.04, 14), { p: [x, 1.6, zc + 0.99], r: [Math.PI / 2, 0, 0], color: 0xaab0b6 }); G.add(GM.Circle(0.12, 16), { p: [x, 1.6, zc + 1.0], color: WARM(0.9), uv: 0 }); }

  // ── propellant tanks on the east end (foil wrapped) ──
  for (const [tx, k] of [[ax + 7.1, 0], [ax + 8.35, 1]]) {
    const tz = az - 0.6, ty = 0.98;
    F.add(GM.Cylinder(0.52, 0.52, 3.0, 26, 1, true), { p: [tx, ty, tz], r: [Math.PI / 2, 0, 0], uv: 0, uvS: [1.7, 1.5] });
    for (const s of [-1, 1]) {
      P.add(GM.Sphere(0.52, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), { p: [tx, ty, tz + s * 1.5], r: [s * Math.PI / 2, 0, 0], color: 0xdcdfe1, uv: 0.5 });
      P.add(GM.Cylinder(0.535, 0.535, 0.22, 26), { p: [tx, ty, tz + s * 1.0], r: [Math.PI / 2, 0, 0], color: 0xe36a14, uv: 0.5 });
      D.add(box(1.4, 0.16, 0.32), { p: [tx, 0.38, tz + s * 1.0], color: 0x44484e });
    }
    M.add(strut([tx, ty + 0.2, tz + 1.6], [tx, 2.0, tz + 1.6], 0.045), { uv: 0, color: 0xc4cad0 });
    P.add(GM.Torus(0.1, 0.014, 5, 14), { p: [tx, 2.05, tz + 1.6], r: [Math.PI / 2, 0, 0], color: 0xc2281c });
    M.add(tubeGeo([[tx, 1.9, tz + 1.6], [tx, 1.9, tz + 2.0], [ax + 6.3, 1.9 - k * 0.3, tz + 2.0]], 0.05, 8), { uv: 0, color: 0xd4d8dc });
  }
  D.add(box(3.2, 0.14, 3.6), { p: [ax + 7.7, 0.22, az - 0.6], color: 0x6e7278, uv: 0.5 });

  // ── east-end service door + signage ──
  P.add(rbox(1.0, 2.0, 0.08, 0.02), { p: [ax + 6.29, 1.28, az + 1.5], r: [0, Math.PI / 2, 0], color: 0xd2d6d9 });
  B.sign(new THREE.PlaneGeometry(0.7, 0.34), 'rot2', { p: [ax + 6.29, 2.45, az + 1.5], r: [0, Math.PI / 2, 0], uv: 0 });

  // ── viewing kiosk with the long-exposure screen ──
  const kx = KIOSK.x, kz = KIOSK.z;
  P.add(rbox(2.5, 0.2, 1.8, 0.04), { p: [kx, 0.0, kz + 0.5], color: 0x888c92, dirt: 0.2 });
  for (const s of [-1, 1]) D.add(rbox(0.15, 2.24, 0.15, 0.03), { p: [kx + s * 0.9, 1.3, kz - 0.02], color: 0x3a3e44 });
  D.add(rbox(2.08, 1.24, 0.26, 0.05), { p: [kx, 1.45, kz - 0.02], color: 0x31353b });
  M.add(rbox(1.84, 1.04, 0.05, 0.02), { p: [kx, 1.45, kz + 0.117], color: 0x131518 });
  P.add(rbox(2.2, 0.07, 0.7, 0.025), { p: [kx, 2.2, kz + 0.28], r: [0.13, 0, 0], color: 0x2e3238 });
  for (const s of [-1, 1]) P.add(box(0.045, 0.48, 0.62), { p: [kx + s * 1.07, 1.97, kz + 0.2], color: 0x2e3238 });
  G.add(box(1.7, 0.03, 0.03), { p: [kx, 2.12, kz + 0.52], color: [2.2, 3.1, 4.2] });
  const cx = kx, cz = kz + 1.45;                                             // console + plaque
  P.add(rbox(0.74, 0.98, 0.46, 0.05), { p: [cx, 0.69, cz], color: 0xdcdfe1, dirt: 0.3 });
  const tilt = 0.5, top = new THREE.BoxGeometry(0.7, 0.05, 0.42); top.rotateX(tilt); top.translate(cx, 1.2, cz); D.add(top, { color: 0x2c3036 });
  for (const [bx, col] of [[-0.18, [0.6, 5, 1.4]], [0, [5, 3.4, 0.6]], [0.18, [5, 0.8, 0.5]]]) { const b = new THREE.BoxGeometry(0.07, 0.02, 0.07); b.translate(bx, 0.045, 0.0); b.rotateX(tilt); b.translate(cx, 1.2, cz); G.add(b, { color: col, uv: 0 }); }
  { const b = new THREE.BoxGeometry(0.46, 0.012, 0.16); b.translate(0, 0.032, -0.08); b.rotateX(tilt); b.translate(cx, 1.2, cz); G.add(b, { color: [0.4, 1.6, 2.4], uv: 0 }); }
  B.sign(new THREE.PlaneGeometry(0.66, 0.2), 'kiosk', { p: [cx, 0.62, cz + 0.232], uv: 0 });
  // the screen itself (animated)
  const ghost = makeGhostScreen(kit), scrMat = kit.screen(ghost.texture, 1.5);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.9113), scrMat); fr.place(screen, kx, 1.45, kz + 0.148); screen.castShadow = false; screen.receiveShadow = false;
  const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.96), kit.glass({ opacity: 0.07, color: 0x9fb8c8 })); fr.place(glassPane, kx, 1.45, kz + 0.153); glassPane.castShadow = false;
  B.group.add(screen, glassPane);

  // ── field recorder inside the alcove (log.charon.1) ──
  const rec = kit.recorder({ title: 'LOG · SCI', sub: 'I. VARGA', accent: '#8fd0ff', scale: 1.3 });
  fr.place(rec, ax + 2.3, 1.05, az + 2.05, 0.35); B.group.add(rec);

  // door light (the slot's 2nd PointLight)
  const lamp = kit.pointLight(0xffd7a0, 8.5, 13, [0, 0, 0]); lamp.position.copy(fr.pos(ax + 2.4, 2.25, az + 3.4)); B.group.add(lamp);

  // ── colliders ──
  const cols = B.colliders;
  cols.push(...obbBoxes(fr, ax, az - 0.75, 6.25, 1.9, 0, 3.7));
  cols.push(...obbBoxes(fr, ax - 2.7, az + 1.9, 3.55, 0.75, 0, 3.7));
  cols.push(...obbBoxes(fr, ax + 4.5, az + 1.9, 1.75, 0.75, 0, 3.7));
  cols.push(...obbBoxes(fr, xm, zc, L / 2, 1.0, 0, 2.55));
  for (const tx of [ax + 7.1, ax + 8.35]) cols.push(...obbBoxes(fr, tx, az - 0.6, 0.55, 1.6, 0, 1.6));
  cols.push(...obbBoxes(fr, kx, kz - 0.02, 1.05, 0.15, 0, 2.4));
  cols.push(...obbBoxes(fr, cx, cz, 0.37, 0.23, 0, 1.25));

  B.updaters.push((dt, t, camPos) => {
    rec.userData.ledUpdate(t);
    if (!camPos || camPos.distanceToSquared(screen.position) < 160 * 160) ghost.tick(t);
  });

  return {
    recorderPos: fr.pos(ax + 2.3, 1.15, az + 2.05), screenPos: fr.pos(kx, 1.35, kz + 1.5), screen, rec,
    lightPos: lamp.position,
  };
}
