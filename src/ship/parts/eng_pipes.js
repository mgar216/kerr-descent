// ENGINEERING — coolant plumbing: spine pipes continuing from the cargo side, port-wall pressure vessels + headers, heat exchanger,
// under-grating lines (the machinery deck is only 0.2 m deep), EURYDICE cracked pipe + venting plume.
import * as THREE from 'three';
import { frame, basicMat } from './bay_util.js';
import { cvs, mulberry } from './textures.js';

function wispTexture() {
  const c = cvs(64, 128), g = c.getContext('2d'), R = mulberry(0x3a7f);
  g.fillStyle = 'rgba(235,246,255,0.7)'; g.fillRect(0, 0, 64, 128);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 90; i++) { const x = R() * 64, y = R() * 128, w = 1 + R() * 6, h = 6 + R() * 34; g.fillStyle = `rgba(0,0,0,${0.25 + R() * 0.7})`; for (const oy of [0, -128, 128]) g.fillRect(x, y + oy, w, h); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function plumeGeometry(r, ak) {   // open cone, apex at the origin spraying toward +x (slightly down); vertex alpha fades toward the open end
  const h = 1.5, geo = new THREE.ConeGeometry(r, h, 16, 4, true), pos = geo.attributes.position, col = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) { const a = (pos.getY(i) + h / 2) / h; col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = 1; col[i * 4 + 3] = ak * Math.pow(a, 1.8); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4)); geo.rotateZ(Math.PI / 2 - 0.35); geo.translate(0.7, -0.1, 0); return geo;
}

export default function pipes(kit, E, D) {
  const L = kit.L, FLOOR = L.FLOOR, CEIL = L.CEIL, eur = kit.eur, ZF = E.ZF, ZA = E.ZA, W = frame(kit, [0, 0, 0], 0), ringY = CEIL - 0.14, R = kit.rand(0xe9);

  // ───────── spine pipes continue through the bulkhead and meet the collector ring around the torus ─────────
  for (const sx of [-1, 1]) {
    const mat = sx < 0 ? 'paintCyan' : 'paintOrange';
    W.beam(mat, [sx * 0.9, ringY, 30.9], [sx * 0.9, ringY, 33.5], 0.07, 0.07, { bev: 0.02 });
    W.box('trim', [sx * 0.9, ringY, ZF + 0.035], [0.15, 0.15, 0.05], { bev: 0.008 });
    W.beam('metal', [sx * 0.78, CEIL - 0.12, 30.9], [sx * 0.78, CEIL - 0.12, 32.3], 0.04, 0.04, { bev: 0.012 });
    for (const z of [31.6, 32.7]) W.box('trim', [sx * 0.84, CEIL - 0.1, z], [0.2, 0.2, 0.06], { bev: 0.006 });
    W.box('trim', [sx * 0.9, ringY, 33.56], [0.17, 0.17, 0.17], { bev: 0.012 });
    W.box('steel', [sx * 0.9, ringY, 32.25], [0.12, 0.12, 0.22], { bev: 0.01 }); W.cyl('steel', [sx * 0.9, ringY + 0.1, 32.25], 0.02, 0.08, { seg: 6 });
    W.torus(sx < 0 ? 'abYellow' : 'abRed', [sx * 0.9, ringY + 0.15, 32.25], 0.05, 0.01, { axis: 'y', tube: 4, seg: 14 });
  }

  // ───────── port wall: 3 pressure vessels, cross-feed, overhead headers ─────────
  const tanks = [
    { z: 32.1, body: 'paintWhite', band: 'paintOrange', st: 'he3', plate: 'plastic', ang: 0.5 },
    { z: 33.3, body: 'abCrateGrey', band: 'abRed', st: 'd2', plate: 'plastic', ang: -0.7 },
    { z: 34.5, body: 'abBlue', band: 'paintWhite', st: 'ln2', plate: 'plasticDark', ang: 0.1 },
  ];
  const tx = -3.05, rt = 0.4;
  tanks.forEach((t) => {
    const f = frame(kit, [tx, FLOOR, t.z], 0);
    f.cyl('trim', [0, 0.07, 0], rt + 0.04, 0.14, { seg: 28 });
    f.cyl(t.body, [0, 0.95, 0], rt, 1.6, { seg: 28 });
    f.sph(t.body, [0, 1.75, 0], rt, { seg: 24, sy: 0.42, th: Math.PI / 2 });
    for (const y of [0.45, 1.0, 1.55]) f.torus(t.band, [0, y, 0], rt + 0.006, 0.022, { axis: 'y', tube: 5, seg: 28 });
    f.cyl('steel', [0, 2.0, 0], 0.06, 0.12, { seg: 10 }); f.cyl('trim', [0, 2.07, 0], 0.085, 0.04, { seg: 10 });
    // nameplate + gauge cluster facing the walkway (+x)
    const G = frame(kit, [tx, FLOOR, t.z], Math.PI / 2);
    G.box(t.plate, [0, 1.15, rt + 0.012], [0.46, 0.18, 0.025], { bev: 0.004 }); G.st(t.st, [0, 1.15, rt + 0.0265], [0.4, 0.1]);
    G.gauge([-0.12, 0.72, rt + 0.005], 0.05, t.ang, { led: eur ? 'emitRed' : 'emitGreen' }); G.gauge([0.12, 0.72, rt + 0.005], 0.05, -t.ang * 0.6, {});
    G.box('plasticDark', [0, 0.72, rt - 0.005], [0.38, 0.12, 0.02], { bev: 0.004 });
    kit.colCyl([tx, FLOOR + 1.0, t.z], 0.45, 2.0);
  });
  W.pipe('paintCyan', [[-0.9, ringY, 32.1], [tx, ringY, 32.1], [tx, 0.96, 32.1]], 0.04, { fl: 0.9 });
  W.pipe('paintCyan', [[tx, 0.96, 32.1], [tx, 0.96, 34.5]], 0.04, { fl: 0.7 });
  for (const z of [33.3, 34.5]) W.pipe('paintCyan', [[tx, 0.96, z], [tx, 0.78, z]], 0.035, { ends: false });
  W.valve([tx, 0.96, 32.7], 'z', 0.05, { wheel: 'abRed', stem: 'y' }); W.valve([tx, 0.96, 33.9], 'z', 0.05, { wheel: 'abRed', stem: 'x' });
  W.pipe('paintOrange', [[tx - 0.15, FLOOR + 0.3, 32.1 + 0.42], [tx - 0.15, FLOOR + 0.3, 33.3 - 0.42]], 0.03, { ends: false }); W.pipe('paintOrange', [[tx - 0.15, FLOOR + 0.3, 33.3 + 0.42], [tx - 0.15, FLOOR + 0.3, 34.5 - 0.42]], 0.03, { ends: false });
  W.valve([tx - 0.15, FLOOR + 0.3, 32.7], 'z', 0.04, { wheel: 'paintOrange', stem: 'x' }); W.valve([tx - 0.15, FLOOR + 0.3, 33.9], 'z', 0.04, { wheel: 'paintOrange', stem: 'x' });
  // orange return along the wall above the tanks, continuing aft to the ladder bay
  W.pipe('paintOrange', [[-3.4, 1.12, 31.3], [-3.4, 1.12, 35.9], [-3.4, 0.3, 35.9]], 0.04, { fl: 0.8 });
  for (const z of [31.8, 33.0, 34.2, 35.4]) W.box('trim', [-3.46, 1.12, z], [0.1, 0.1, 0.07], { bev: 0.006 });
  W.st('coolA', [-3.5, 0.9, 33.0], [0.56, 0.14], { ry: Math.PI / 2 }); W.st('coolB', [-3.5, 1.0, 35.4], [0.56, 0.14], { ry: Math.PI / 2 });
  // heat exchanger cabinet (starboard-forward, beside the door) fed from the orange spine
  {
    const f = frame(kit, [3.25, FLOOR, 31.65], -Math.PI / 2);
    f.box('white', [0, 0.72, 0.0], [1.0, 1.44, 0.5], { bev: 0.012, col: false });
    f.box('trim', [0, 0.06, 0.0], [1.04, 0.12, 0.54], { bev: 0.008 });
    f.box('paintOrange', [0, 1.46, 0.0], [1.04, 0.04, 0.54], { bev: 0.006 });
    for (let i = 0; i < 7; i++) f.box('trim', [-0.34 + i * 0.113, 0.95, 0.256], [0.075, 0.009, 0.01], { bev: 0 });
    for (let i = 0; i < 7; i++) f.box('trim', [-0.34 + i * 0.113, 0.8, 0.256], [0.075, 0.009, 0.01], { bev: 0 });
    f.st('coolB', [0, 0.45, 0.256], [0.5, 0.125], {});
    f.gauge([-0.3, 0.22, 0.26], 0.055, 0.8, {}); f.gauge([0.3, 0.22, 0.26], 0.055, -0.4, { led: 'emitAmber' });
    f.box(kit.led(eur ? 'Red' : 'Green', ''), [0.0, 1.25, 0.256], [0.02, 0.02, 0.006], { bev: 0 });
    f.col([0, 0.8, 0.0], [1.06, 1.6, 0.56]);
  }
  W.pipe('paintOrange', [[0.9, ringY, 31.6], [3.25, ringY, 31.6], [3.25, 0.4, 31.6]], 0.04, { fl: 0.9 });

  // ───────── under the grating (0.2 m deep deck: slab top y=-1.4) ─────────
  const uy = FLOOR - 0.12;
  W.pipe('paintCyan', [[-2.4, uy, 31.2], [-2.4, uy, 37.8]], 0.045, { fl: 1.4 });
  W.pipe('paintOrange', [[2.4, uy, 31.2], [2.4, uy, 37.8]], 0.045, { fl: 1.4 });
  W.pipe('paintCyan', [[-2.4, uy, 32.0], [-0.0, uy, 32.0]], 0.032, { fl: 1.2, ends: false }); W.pipe('paintOrange', [[2.4, uy, 36.9], [0.0, uy, 36.9]], 0.032, { fl: 1.2, ends: false });
  for (const [x, z] of [[-2.4, 33.6], [2.4, 35.3], [-2.4, 36.5], [2.4, 32.6]]) { W.box('trim', [x, uy, z], [0.14, 0.12, 0.2], { bev: 0.008 }); W.box(kit.led('Green', 'Blink'), [x + 0.071, uy, z], [0.004, 0.02, 0.02], { bev: 0 }); }

  // ───────── EURYDICE: one cracked pipe venting a cold plume ─────────
  if (eur) {
    const cz2 = 35.55;
    W.box('abSoot', [tx, 0.96, cz2], [0.11, 0.11, 0.16], { bev: 0.01 });
    W.box('trim', [tx + 0.045, 0.99, cz2 + 0.02], [0.03, 0.04, 0.09], { bev: 0.003, rz: 0.4 });
    W.pipe('paintCyan', [[tx, 0.96, 34.5], [tx, 0.96, 35.45]], 0.04, { ends: true }); W.pipe('paintCyan', [[tx, 0.96, 35.65], [tx, 0.96, 36.5]], 0.04, { ends: true });
    const tex = wispTexture(), mat = basicMat(0.6, 0.85, 1.0, { map: tex, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexColors: true });
    const wisps = [kit.mesh(plumeGeometry(0.5, 0.5), mat, { pos: [tx + 0.05, 0.96, cz2], name: 'ventPlume' }), kit.mesh(plumeGeometry(0.3, 1.0), mat, { pos: [tx + 0.05, 0.96, cz2], name: 'ventPlumeCore' })];
    kit.onUpdate((dt, t) => { tex.offset.x += dt * 0.25; tex.offset.y -= dt * 0.7; mat.opacity = 0.35 + 0.5 * D.flick * (0.75 + 0.25 * Math.sin(t * 13)); for (const w of wisps) w.scale.set(1 + 0.1 * Math.sin(t * 7), 1, 1 + 0.1 * Math.sin(t * 5)); });
    for (let i = 0; i < 6; i++) W.sph('paintWhite', [tx + 0.3 + R() * 1.0, FLOOR + 0.02, cz2 - 0.3 + R() * 0.8], 0.05 + R() * 0.07, { seg: 6, sy: 0.3 });
  }
}
