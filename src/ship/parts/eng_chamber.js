// ENGINEERING — aft viewport (frame + thick glass + shutter) and the REACTION CHAMBER behind it (z 38..41): coil rings, glowing core,
// tapering throat toward the nozzle (drive.js builds from z=41, throat radius 0.7). Glow follows D.lvl and the lighting mode.
import * as THREE from 'three';
import { frame, dynSink, basicMat } from './bay_util.js';
const V2 = THREE.Vector2;

export default function chamber(kit, E, D) {
  const L = kit.L, eur = kit.eur, EW = L.ENG_WINDOW, DR = L.DRIVE, FLOOR = L.FLOOR, T = kit.T, ZA = E.ZA, ay = DR.axisY, W = frame(kit, [0, 0, 0], 0);
  const wy = (EW.y0 + EW.y1) / 2, ww = EW.x1 - EW.x0, wh = EW.y1 - EW.y0;

  // ───────── frame, reveal, glass ─────────
  const fz = ZA - 0.04;
  W.box('trim', [0, EW.y1 + 0.09, fz], [ww + 0.36, 0.18, 0.08], { bev: 0.01 });
  W.box('trim', [0, EW.y0 - 0.09, fz], [ww + 0.36, 0.18, 0.08], { bev: 0.01 });
  for (const sx of [-1, 1]) W.box('trim', [sx * (ww / 2 + 0.09), wy, fz], [0.18, wh + 0.36, 0.08], { bev: 0.01 });
  W.box('paintOrange', [0, EW.y1 + 0.18, fz - 0.041], [ww + 0.36, 0.022, 0.006], { bev: 0 });
  W.box('paintOrange', [0, EW.y0 - 0.18, fz - 0.041], [ww + 0.36, 0.022, 0.006], { bev: 0 });
  for (const sx of [-1, 1]) W.box('paintOrange', [sx * (ww / 2 + 0.18), wy, fz - 0.041], [0.022, wh + 0.36, 0.006], { bev: 0 });
  W.box('emitStrip', [0, EW.y1 - 0.01, fz - 0.03], [ww, 0.014, 0.012], { bev: 0 });
  W.box('emitStrip', [0, EW.y0 + 0.01, fz - 0.03], [ww, 0.014, 0.012], { bev: 0 });
  for (const sx of [-1, 1]) W.box('emitStrip', [sx * (ww / 2 - 0.01), wy, fz - 0.03], [0.014, wh, 0.012], { bev: 0 });
  for (let x = -1.55; x <= 1.56; x += 0.26) for (const y of [EW.y1 + 0.09, EW.y0 - 0.09]) W.cyl('steel', [x, y, fz - 0.044], 0.014, 0.01, { axis: 'z', seg: 6 });
  for (const sx of [-1, 1]) for (let y = EW.y0 + 0.1; y < EW.y1; y += 0.26) W.cyl('steel', [sx * (ww / 2 + 0.09), y, fz - 0.044], 0.014, 0.01, { axis: 'z', seg: 6 });
  for (const y of [EW.y0, EW.y1]) W.box('trimDS', [0, y, ZA + 0.075], [ww, 0.012, 0.15], { bev: 0 });
  for (const sx of [-1, 1]) W.box('trimDS', [sx * ww / 2, wy, ZA + 0.075], [0.012, wh, 0.15], { bev: 0 });
  W.box('glassInt', [0, wy, ZA + 0.05], [ww, wh, 0.07], { bev: 0 });
  W.box('glass', [0, wy, ZA + 0.0], [ww, wh, 0.04], { bev: 0 });
  for (const sy of [-1, 1]) W.box('glassTint', [0, wy + sy * (wh / 2 - 0.012), ZA + 0.025], [ww, 0.024, 0.09], { bev: 0 });
  for (const sx of [-1, 1]) W.box('glassTint', [sx * (ww / 2 - 0.012), wy, ZA + 0.025], [0.024, wh, 0.09], { bev: 0 });
  if (eur) {
    kit.defMat('frostGlassE', { tex: T.frost, uv: 'own', color: 0xdbeaf8, rough: 0.55, metal: 0, transparent: true, opacity: 0.72, doubleSide: true }); kit.mat('frostGlassE');
    W.plane('frostGlassE', [0, wy, ZA - 0.012], ww, wh, { ry: Math.PI });
  }
  // blast-shutter cassette above, service plinth + viewing rail below
  W.box('trim', [0, 1.1, ZA - 0.07], [ww + 0.4, 0.3, 0.14], { bev: 0.012 });
  W.box('hazard', [0, 0.97, ZA - 0.07], [ww + 0.4, 0.04, 0.145], { bev: 0 });
  W.sign('BLAST SHUTTER · AUTO-CLOSE ON BURN', [0, 1.12, ZA - 0.143], { w: 1.5, h: 0.12, style: 'door', ry: Math.PI });
  W.box('wallDark', [0, FLOOR + 0.135, ZA - 0.07], [ww + 0.36, 0.27, 0.14], { bev: 0.008 });
  W.st('rad', [-1.2, FLOOR + 0.135, ZA - 0.145], [0.2, 0.2], { ry: Math.PI });
  W.sign('REACTION CHAMBER · NO ENTRY', [0.1, FLOOR + 0.135, ZA - 0.145], { w: 1.4, h: 0.13, style: 'warn', ry: Math.PI });
  W.st('hv', [1.3, FLOOR + 0.135, ZA - 0.145], [0.2, 0.2], { ry: Math.PI });
  for (const x of [-1.7, 0, 1.7]) W.cyl('abYellow', [x, FLOOR + 0.42, ZA - 0.6], 0.02, 0.84, { seg: 8 });
  W.cyl('abYellow', [0, FLOOR + 0.84, ZA - 0.6], 0.022, 3.44, { axis: 'x', seg: 8 });
  W.cyl('abYellow', [0, FLOOR + 0.45, ZA - 0.6], 0.016, 3.44, { axis: 'x', seg: 8 });

  // ───────── chamber: back plate with the bore, shell, coils, ribs, throat ─────────
  {
    const sh = new THREE.Shape(); sh.moveTo(-1.9, -1.25); sh.lineTo(1.9, -1.25); sh.lineTo(1.9, 1.55); sh.lineTo(-1.9, 1.55); sh.closePath();
    const hole = new THREE.Path(); hole.absarc(0, ay, DR.chamberR, 0, Math.PI * 2, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false, curveSegments: 40 });
    kit.add('abCeramicDark', g, { pos: [0, 0, ZA + 0.15] }); g.dispose();
  }
  const ch = frame(kit, [0, ay, 0], 0), zS = ZA + 0.27, zC = 40.15, zT = DR.throatZ, rC = DR.chamberR, rT = DR.throatR;
  const rAt = (z) => (z <= zC ? rC : rC - (rC - rT) * (z - zC) / (zT - zC));
  const shellGeo = new THREE.LatheGeometry([[rC, zS], [rC, zC], [rT, zT]].map(([r, z]) => new V2(r, z)), 56); shellGeo.rotateX(Math.PI / 2); shellGeo.translate(0, ay, 0);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide, emissive: new THREE.Color(0, 0, 0) });
  kit.mesh(shellGeo, shellMat, { name: 'chamberShell' });
  for (const z of [38.5, 38.9, 39.3, 39.7, 40.1, 40.42, 40.66, 40.84]) ch.torus('abCopper', [0, 0, z], rAt(z) - 0.05, z > 40.2 ? 0.032 : 0.048, { axis: 'z', tube: 5, seg: 40 });
  for (let k = 0; k < 14; k++) { const t = k * Math.PI * 2 / 14; ch.box('trim', [Math.cos(t) * (rC - 0.04), Math.sin(t) * (rC - 0.04), 39.3], [0.06, 0.07, 1.9], { bev: 0.008, rz: t }); }
  for (let k = 0; k < 6; k++) { const t = k * Math.PI / 3 + 0.5; ch.cyl('steel', [Math.cos(t) * (rC - 0.1), Math.sin(t) * (rC - 0.1), 38.62], 0.07, 0.22, { axis: 'z', seg: 10 }); ch.cyl('darkMetal', [Math.cos(t) * (rC - 0.1), Math.sin(t) * (rC - 0.1), 38.74], 0.045, 0.05, { axis: 'z', seg: 10 }); }
  ch.torus('abCopper', [0, 0, zT - 0.02], rT + 0.02, 0.05, { axis: 'z', tube: 6, seg: 40 });
  ch.torus('trim', [0, 0, zS + 0.02], rC - 0.02, 0.08, { axis: 'z', tube: 5, seg: 40 });

  // ───────── dynamic glows ─────────
  const coilMat = basicMat(1, 0.5, 0.15), coreMat = basicMat(0.4, 0.9, 1, { transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), hotMat = basicMat(0.9, 0.95, 1), warnMat = basicMat(1, 0.55, 0.12);
  {
    const sk = dynSink(), P = frame(kit, [0, ay, 0], 0, sk);
    for (const z of [38.7, 39.1, 39.5, 39.9, 40.28, 40.54, 40.76]) P.torus('x', [0, 0, z], rAt(z) - 0.1, 0.012, { axis: 'z', tube: 3, seg: 40 });
    kit.mesh(sk.build(), coilMat, { name: 'chamberCoilGlow' });
    const sc = dynSink(), Q = frame(kit, [0, ay, 0], 0, sc);
    for (const [sx, sz] of [[0.4, 1.1], [0.27, 0.85], [0.15, 0.6]]) Q.sph('x', [0, 0, 39.5], 1, { seg: 20, sx, sy: sx, sz });
    kit.mesh(sc.build(), coreMat, { name: 'chamberCore' });
    const sh2 = dynSink(), H = frame(kit, [0, ay, 0], 0, sh2);
    H.cyl('x', [0, 0, 39.5], 0.045, 1.7, { axis: 'z', seg: 10 });
    H.torus('x', [0, 0, zT - 0.07], rT - 0.02, 0.022, { axis: 'z', tube: 4, seg: 40 });
    const disc = new THREE.CircleGeometry(rT - 0.03, 40); disc.rotateY(Math.PI); disc.translate(0, ay, zT - 0.05);
    sh2.add('x', disc, {}); disc.dispose();
    kit.mesh(sh2.build(), hotMat, { name: 'chamberHot' });
  }
  const spr = (z, s0) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowSprite(), color: new THREE.Color(0.5, 0.8, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: 0.3 })); sp.position.set(0, ay, z); sp.scale.setScalar(s0); sp.userData.s0 = s0; kit.root.add(sp); return sp; };
  const glow1 = spr(39.5, 2.6), glow2 = spr(40.85, 1.7);
  // status lamps beside the viewport (amber idle → red when the drive is burning)
  {
    const sk = dynSink(), P = frame(kit, [0, 0, 0], 0, sk);
    for (const sx of [-1, 1]) { P.cyl('x', [sx * 2.1, 0.82, ZA - 0.03], 0.055, 0.03, { axis: 'z', seg: 14 }); P.cyl('x', [sx * 2.1, 0.62, ZA - 0.03], 0.055, 0.03, { axis: 'z', seg: 14 }); }
    kit.mesh(sk.build(), warnMat, { name: 'driveLamps' });
    for (const sx of [-1, 1]) { W.box('trim', [sx * 2.1, 0.72, ZA - 0.015], [0.14, 0.4, 0.03], { bev: 0.006 }); W.sign(sx < 0 ? 'DRIVE LIVE' : 'STAND CLEAR', [sx * 2.1, 0.42, ZA - 0.032], { w: 0.28, h: 0.07, style: 'red', ry: Math.PI }); }
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  kit.onUpdate((dt, t) => {
    const lvl = D.lvl, mk = D.mk, fl = 0.9 + 0.1 * Math.sin(t * 31) * Math.sin(t * 17);
    let kc, kk, kh, spA;
    if (eur) { const f = D.fail; kc = 0.05 + 1.2 * f; kk = 0.02 + 0.8 * f; kh = 0.02 + 1.0 * f; spA = 0.01 + 0.1 * f; coilMat.color.setRGB(kc, kc * 0.35, kc * 0.1); coreMat.color.setRGB(kk, kk * 0.3, kk * 0.12); hotMat.color.setRGB(kh, kh * 0.45, kh * 0.2); shellMat.emissive.setRGB(0.08 * f, 0.02 * f, 0.01 * f); }
    else {
      kc = (0.5 + 2.4 * lvl) * mk; kk = (1.3 + 9 * lvl) * mk * fl; kh = (0.8 + 13 * lvl) * mk * fl; spA = (0.12 + 0.55 * lvl) * mk;
      coilMat.color.setRGB(lerp(1, 0.45, lvl) * kc, lerp(0.5, 0.85, lvl) * kc, lerp(0.15, 1, lvl) * kc);
      coreMat.color.setRGB((0.4 + 0.45 * lvl) * kk * 0.6, (0.9 + 0.08 * lvl) * kk * 0.6, kk * 0.6); hotMat.color.setRGB(0.95 * kh, 0.97 * kh, kh);
      const ke = (0.015 + 0.34 * lvl) * mk; shellMat.emissive.setRGB(lerp(0.9, 0.4, lvl) * ke, lerp(0.45, 0.75, lvl) * ke, lerp(0.15, 1, lvl) * ke);
    }
    for (const sp of [glow1, glow2]) { sp.material.opacity = Math.min(0.95, spA); sp.scale.setScalar(sp.userData.s0 * (1 + 0.45 * lvl) * (eur ? 0.7 : 1)); }
    const burn = lvl > 0.04 && !eur, k2 = (burn ? (Math.sin(t * 8) > -0.2 ? 3.2 : 0.4) : 0.55) * (D.ms ?? 1);
    warnMat.color.setRGB(burn ? 1 : 1, burn ? 0.12 : 0.5, burn ? 0.08 : 0.1); warnMat.color.multiplyScalar(eur ? 0.12 * D.flick : k2);
  });
}
