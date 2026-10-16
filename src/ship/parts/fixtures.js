// Exterior fixtures: nav lights, strobes, floodlights (emissive + additive glow sprites), high-gain dish, antennas, RCS quads.
import * as THREE from 'three';

const V3 = THREE.Vector3;

export default function build(kit) {
  const L = kit.L, T = kit.T, eur = kit.eur, R = kit.rand(0xf1c7);
  const glow = T.glowSprite();
  const sprite = (pos, rgb, size, opacity = 1) => {
    const m = new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(...rgb), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, toneMapped: false });
    const s = new THREE.Sprite(m); s.position.set(...pos); s.scale.set(size, size, 1); s.name = 'glow'; kit.root.add(s); return s;
  };

  // ───────── navigation lights (red port / green starboard) ─────────
  const navs = [];
  for (const sx of [-1, 1]) {
    const x = sx * 3.85, y = 0.85, z = 2.34, dead = eur && sx < 0;
    kit.box('darkMetal', [x, y, z + 0.02], [0.24, 0.2, 0.12], { bev: 0.02, ext: true });
    kit.sphere(dead ? 'trim' : (sx < 0 ? 'navRed' : 'navGreen'), [x, y, z - 0.05], 0.075, { seg: 12, ext: true });
    if (!dead) navs.push({ s: sprite([x, y, z - 0.1], sx < 0 ? [3, 0.25, 0.2] : [0.25, 3, 0.7], 0.9), base: 0.9 });
  }

  // ───────── strobes (double flash) ─────────
  const strobeMat = kit.mat('strobe');
  const strobes = [];
  const strobeAt = (x, y, z, alive) => {
    kit.cyl('darkMetal', [x, y - 0.04, z], 0.1, 0.08, { seg: 12, ext: true });
    if (alive) { kit.sphere('strobe', [x, y + 0.02, z], 0.07, { seg: 12, ext: true }); strobes.push(sprite([x, y + 0.05, z], [3, 3, 3.4], 1.4, 0)); }
    else kit.sphere('trim', [x, y + 0.02, z], 0.07, { seg: 10, ext: true });
  };
  strobeAt(0, 2.32, 36.2, true); strobeAt(0, -1.6, 18, !eur); strobeAt(-4.2, 1.35, 3.1, !eur); strobeAt(4.2, 1.35, 3.1, !eur);
  const blink = (t) => { const p = (t % 1.4); return (p < 0.07 || (p > 0.17 && p < 0.24)) ? 1 : 0; };

  // ───────── floodlights ─────────
  const floods = [];
  const flood = (x, y, z, rot, alive = true) => {
    kit.box('darkMetal', [x, y, z], [0.3, 0.2, 0.26], { bev: 0.03, ext: true, rot });
    const lens = new THREE.Object3D(); lens.position.set(x, y, z); lens.rotation.set(...rot);
    const off = new V3(0, -0.08, 0.15).applyEuler(lens.rotation);
    kit.sphere(alive ? 'flood' : 'trim', [x + off.x, y + off.y, z + off.z], 0.07, { seg: 10, sy: 0.6, ext: true });
    if (alive) floods.push(sprite([x + off.x, y + off.y, z + off.z], [1.0, 0.9, 0.7], 0.6, 0.35));
  };
  flood(-3.6, 1.62, 3.4, [0.5, 0, 0.0], !eur); flood(3.6, 1.62, 3.4, [0.5, 0, 0.0], true);
  flood(-4.5, 0.95, 18.6, [0, -Math.PI / 2, 0.4], !eur); flood(4.5, 0.95, 18.6, [0, Math.PI / 2, -0.4], true);
  flood(-1.7, -1.55, 24.2, [-0.9, 0, 0], true); flood(1.7, -1.55, 24.2, [-0.9, 0, 0], !eur);

  // ───────── high-gain dish on a dorsal pedestal ─────────
  const dishRoot = kit.group('dish', { pos: [0, L.ROOF_Y + 0.55, 26.3] });
  kit.cyl('darkMetal', [0, L.ROOF_Y + 0.04, 26.3], 0.38, 0.08, { seg: 20, ext: true });
  kit.cyl('metal', [0, L.ROOF_Y + 0.3, 26.3], 0.12, 0.5, { seg: 14, ext: true });
  kit.defMat('dishMat', { color: 0xe4e7ec, rough: 0.3, metal: 0.6, doubleSide: true });
  const prof = []; for (let i = 0; i <= 14; i++) { const r = 1.15 * i / 14; prof.push(new THREE.Vector2(r, r * r / 4.2)); } for (let i = 14; i >= 0; i--) { const r = 1.15 * i / 14; prof.push(new THREE.Vector2(r, r * r / 4.2 - 0.035)); }
  const dishPitch = kit.group('dishPitch', { parent: dishRoot, pos: [0, 0.35, 0] });
  const dish = kit.mesh(new THREE.LatheGeometry(prof, 36), 'dishMat', { parent: dishPitch, ext: true, rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.1] });
  for (const sx of [-1, 1]) { kit.mesh(new THREE.BoxGeometry(0.06, 0.5, 0.08), 'darkMetal', { parent: dishRoot, pos: [sx * 0.26, 0.1, 0], ext: true }); }
  const feed = kit.group('feed', { parent: dishPitch });
  const cylBetween = (parent, mat, a, b, r) => { const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), m = kit.mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat, { parent, ext: true }); m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); return m; };
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; cylBetween(feed, 'metal', [Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.22], [0, 0, 1.15], 0.012); }
  kit.mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.22, 12), 'darkMetal', { parent: feed, pos: [0, 0, 1.2], rot: [Math.PI / 2, 0, 0], ext: true });
  kit.mesh(new THREE.SphereGeometry(0.05, 10, 8), kit.led('Red', 'Blink'), { parent: feed, pos: [0, 0.07, 1.3] });
  dishPitch.rotation.x = -0.6; dishPitch.position.z = 0;
  if (eur) { dishPitch.rotation.set(-0.15, 0.5, 0.35); dishRoot.rotation.y = 0.9; }
  kit.onUpdate((dt, t) => { if (!eur) { dishRoot.rotation.y = Math.sin(t * 0.07) * 0.9 + 0.2; dishPitch.rotation.x = -0.55 + Math.sin(t * 0.11 + 1) * 0.12; } });

  // ───────── antennas + sensor mast ─────────
  for (const sx of [-1, 1]) {
    const broken = eur && sx > 0;
    kit.cyl('darkMetal', [sx * 3.3, L.ROOF_Y + 0.05, 3.7], 0.06, 0.1, { seg: 10, ext: true });
    kit.cyl('metal', [sx * 3.3, L.ROOF_Y + (broken ? 0.45 : 0.9), 3.7], 0.012, broken ? 0.7 : 1.7, { seg: 6, ext: true, rot: broken ? [0, 0, sx * 0.5] : undefined });
  }
  kit.box('darkMetal', [1.6, L.ROOF_Y + 0.12, 24.6], [0.5, 0.24, 0.16], { bev: 0.03, ext: true }); kit.box('metal', [1.6, L.ROOF_Y + 0.46, 24.6], [0.05, 0.5, 0.35], { bev: 0.01, ext: true });
  kit.cyl('metal', [-2.1, L.ROOF_Y + 0.5, 24.8], 0.04, 1.0, { seg: 8, ext: true });
  for (let k = 0; k < 3; k++) { const a = k * 2.1; kit.cyl('darkMetal', [-2.1 + Math.cos(a) * 0.14, L.ROOF_Y + 1.05, 24.8 + Math.sin(a) * 0.14], 0.05, 0.16, { seg: 10, ext: true }); kit.cyl('screenOff', [-2.1 + Math.cos(a) * 0.14, L.ROOF_Y + 1.14, 24.8 + Math.sin(a) * 0.14], 0.035, 0.02, { seg: 10, ext: true }); }

  // ───────── RCS quads ─────────
  const rcs = (x, y, z, outX) => {
    kit.box('darkMetal', [x, y, z], [0.34, 0.34, 0.5], { bev: 0.03, ext: true });
    kit.box('carbon', [x + outX * 0.12, y, z], [0.12, 0.4, 0.56], { bev: 0.02, ext: true });
    const n = (dx, dy, dz, rot) => { kit.cyl('bronze', [x + dx, y + dy, z + dz], 0.065, 0.14, { rb: 0.03, seg: 10, ext: true, rot }); kit.cyl('screenOff', [x + dx * 1.18, y + dy * 1.18, z + dz * 1.18], 0.055, 0.01, { seg: 10, ext: true, rot }); };
    n(0, 0.22, 0, [0, 0, 0]); n(0, -0.22, 0, [Math.PI, 0, 0]); n(0, 0, 0.32, [Math.PI / 2, 0, 0]); n(0, 0, -0.32, [-Math.PI / 2, 0, 0]);
    kit.box('trim', [x + outX * 0.08, y, z], [0.22, 0.3, 0.02], { bev: 0.004, ext: true });
  };
  for (const sx of [-1, 1]) { rcs(sx * 4.18, 1.15, 2.7, sx); rcs(sx * 4.42, 0.9, 22.9, sx); rcs(sx * 3.98, 0.85, 37.1, sx); rcs(sx * 1.0, -1.3, -2.2, sx); }

  // ───────── per-frame: strobes + glow pulse ─────────
  kit.onUpdate((dt, t) => {
    const f = blink(t), alive = eur ? (Math.sin(t * 2.3) > 0.3 ? 0.4 : 0) : 1;
    strobeMat.color.setScalar(eur ? 8 * alive * f : 8 * (0.03 + 0.97 * f));
    for (const s of strobes) s.material.opacity = eur ? 0.6 * f * alive : f;
    for (let i = 0; i < navs.length; i++) navs[i].s.material.opacity = (0.55 + 0.1 * Math.sin(t * 1.7 + i)) * (eur ? 0.45 + 0.4 * (kit.state.flicker) : 1);
    for (const s of floods) s.material.opacity = 0.28 + 0.04 * Math.sin(t * 0.6);
  });
}
