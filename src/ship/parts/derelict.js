// EURYDICE derelict dressing (variant 'eurydice' only): frost on glass, hanging cables + icicles, floating debris, scorch marks.
// (Frost on lit surfaces + dead screens + emergency light flicker + jammed doors are handled by kit/model/structure.)
import * as THREE from 'three';
import { cvs, mulberry } from './textures.js';
import { MeshBuilder, placement } from './builder.js';

const V3 = THREE.Vector3;

function scorchTexture(seed, streak) {
  const W = 256, H = 256, c = cvs(W, H), g = c.getContext('2d'), R = mulberry(seed);
  g.clearRect(0, 0, W, H);
  const blob = (x, y, rx, ry, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry)); gr.addColorStop(0, `rgba(8,6,5,${a})`); gr.addColorStop(0.55, `rgba(14,11,10,${a * 0.5})`); gr.addColorStop(1, 'rgba(20,16,14,0)'); g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2); g.fill(); g.restore(); };
  if (streak) { for (let i = 0; i < 18; i++) blob(W * (0.3 + R() * 0.4), H * (0.2 + R() * 0.7), 22 + R() * 30, 60 + R() * 70, 0.25 + R() * 0.25); blob(W / 2, H * 0.82, 70, 40, 0.8); }
  else { blob(W / 2, H / 2, 105, 90, 0.85); for (let i = 0; i < 10; i++) { const a = R() * 6.283, d = 40 + R() * 60; blob(W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d, 26 + R() * 28, 22 + R() * 26, 0.35); } }
  const id = g.getImageData(0, 0, W, H), d = id.data;   // soot speckle / breakup
  for (let i = 0; i < d.length; i += 4) d[i + 3] *= 0.75 + R() * 0.35;
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(kit) {
  if (!kit.eur) return;
  const L = kit.L, T = kit.T, R = kit.rand(0xde1e), FLOOR = L.FLOOR, CEIL = L.CEIL;

  // ───────── frost on glass ─────────
  // frost on glass: one merged unlit mesh (stays icy blue-white under the amber emergency lighting)
  const frostB = new MeshBuilder('own', 1), _fm = new THREE.Matrix4();
  const frostMat = new THREE.MeshBasicMaterial({ map: T.frost().map, color: new THREE.Color(0.5, 0.63, 0.8), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  frostMat.name = 'frostGlass'; frostMat.userData = { glass: true, emissive: true };
  const gridPane = (rows, cols, pt, off) => {         // pt(u,v) → V3 ; frost quad grid with UVs, offset by `off`
    const p = [], uv = [], idx = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const q = pt(i / cols, j / rows).add(off); p.push(q.x, q.y, q.z); uv.push(i / cols, 1 - j / rows); }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    frostB.addGeometry(g, _fm.identity()); g.dispose();
  };
  {   // canopy: front pane + two side panes (same corner points as canopy.js)
    const hdr = new THREE.CatmullRomCurve3([[-0.6, 0.72, -0.64], [-0.2, 0.765, -0.66], [0.2, 0.765, -0.66], [0.6, 0.72, -0.64]].map((q) => new V3(...q)));
    const sil = new THREE.CatmullRomCurve3([[-1.02, -0.42, -0.95], [-0.4, -0.43, -1.0], [0.4, -0.43, -1.0], [1.02, -0.42, -0.95]].map((q) => new V3(...q)));
    gridPane(8, 14, (u, v) => hdr.getPoint(u).lerp(sil.getPoint(u), v), new V3(0, 0, 0.012));
    for (const sx of [-1, 1]) {
      const P00 = new V3(sx * 1.02, -0.42, -0.95), P10 = new V3(sx * 0.6, 0.72, -0.64), P11 = new V3(sx * 0.78, 0.86, 0.35), P01 = new V3(sx * 1.25, -0.2, 0.3);
      gridPane(8, 8, (u, v) => P10.clone().lerp(P11, u).lerp(P00.clone().lerp(P01, u), v), new V3(-sx * 0.012, 0, 0));
    }
  }
  for (const w of L.WINDOWS) {           // portholes / galley window: frost disc or quad inside the lining plane
    const s = w.side, inner = L.innerX(w.z), x = s * (inner + 0.07);
    const g = w.kind === 'round' ? new THREE.CircleGeometry(w.r, 28) : new THREE.PlaneGeometry(w.w, w.h);
    frostB.addGeometry(g, placement({ pos: [x, w.y, w.z], rot: [0, -s * Math.PI / 2, 0] }, _fm)); g.dispose();
  }
  { const fm = kit.mesh(frostB.build(), frostMat, { receive: false, cast: false }); fm.renderOrder = 11; fm.name = 'frostGlass'; }

  // ───────── hanging cables + icicles ─────────
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, z = 3.5 + R() * 20, x = side * (0.5 + R() * 0.45), len = 0.45 + R() * 0.7, sway = (R() - 0.5) * 0.4;
    if (side > 0 && z > 7.2 && z < 12.2) continue;
    kit.tube('rubber', [[x, CEIL, z], [x + sway * 0.3, CEIL - len * 0.4, z + 0.04], [x + sway, CEIL - len, z + 0.1]], 0.018, { rseg: 5, seg: 8 });
    kit.box('trim', [x, CEIL - 0.03, z], [0.07, 0.05, 0.07], { bev: 0.004 });
  }
  kit.defMat('ice', { color: 0xcfe6fa, rough: 0.15, metal: 0, transparent: true, opacity: 0.8, depthWrite: false, noShadow: true });
  const iceCone = (x, y, z, len, r) => { const g = new THREE.ConeGeometry(r, len, 6, 1); kit.add('ice', g, { pos: [x, y - len / 2, z], rot: [Math.PI, 0, 0] }); g.dispose(); };
  for (const sx of [-1, 1]) for (let z = 3.0; z < 23.5; z += 0.55 + R() * 0.7) {
    if (sx > 0 && z > 7.5 && z < 11.8) continue;
    const n = 1 + ((R() * 2) | 0);
    for (let k = 0; k < n; k++) iceCone(sx * (0.78 + R() * 0.16), CEIL - 0.17, z + (R() - 0.5) * 0.3, 0.08 + R() * 0.3, 0.012 + R() * 0.016);
  }
  for (const z of [26.5, 29.5, 33, 36]) for (const sx of [-1, 1]) iceCone(sx * 3.2, CEIL - 0.05, z, 0.12 + R() * 0.25, 0.02);

  // ───────── scorch marks ─────────
  const sc = [scorchTexture(11, false), scorchTexture(22, true), scorchTexture(33, false)];
  const dec = (i, pos, size, rot, op = 0.85) => kit.decal(sc[i], pos, size, { rot, opacity: op, name: 'scorch' });
  const FX = Math.PI / 2;
  dec(1, [-1.085, 0.05, 20.6], [1.7, 1.5], [0, FX, 0]);                 // corridor port wall
  dec(0, [1.085, -0.1, 22.0], [1.4, 1.4], [0, -FX, 0]);                 // corridor starboard wall
  dec(2, [0.4, CEIL - 0.003, 15.5], [1.8, 1.8], [FX, 0, 0], 0.75);      // corridor ceiling
  dec(1, [-2.3, FLOOR + 0.004, 28.0], [2.4, 3.2], [-FX, 0, 0], 0.8);    // cargo floor (lander cradle burn)
  dec(0, [-2.2, 0.1, 37.915], [1.5, 1.4], [0, Math.PI, 0], 0.8);        // engineering aft bulkhead
  dec(2, [2.2, 0.15, 2.322], [1.5, 1.3], [0, Math.PI, 0], 0.8);         // flight-deck rear bulkhead
  dec(1, [L.HAB_SKIN + 0.015, 0.1, 25.0], [2.0, 1.8], [0, FX, 0], 0.7); // hull flank (starboard, near the cargo joint)
  dec(0, [-(L.AFT_SKIN + 0.015), 0.2, 30.0], [1.9, 1.6], [0, -FX, 0], 0.7);

  // ───────── the photograph (`eur.photo`): Elena kept it on her console, where she'd see it every time she looked up from the controls ─────────
  {
    const pt = T.photoTex(true), c = [-0.915, -0.372, -0.9], rot = [-0.34, 0.2, 0];
    kit.defMat('photoEur', { tex: () => ({ map: pt }), uv: 'own', color: 0xffffff, rough: 0.55, metal: 0 });
    kit.box('wood', c, [0.16, 0.12, 0.012], { rot, bev: 0.003 });
    const off = new V3(0, 0, 0.0068).applyEuler(new THREE.Euler(...rot));
    kit.plane('photoEur', [c[0] + off.x, c[1] + off.y, c[2] + off.z], 0.136, 0.102, { rot });
    kit.interact({ id: 'eur.photo', label: 'Photograph', pos: c, radius: 1.6, hit: { c, s: [0.22, 0.18, 0.18] } });
  }

  // ───────── floating debris (non-colliding; slow drift) ─────────
  kit.defMat('paper', { color: 0xe6e2d6, rough: 0.9, metal: 0, doubleSide: true });
  const kinds = [
    { n: 14, geo: new THREE.PlaneGeometry(0.21, 0.297), mat: 'paper' },
    { n: 8, geo: new THREE.BoxGeometry(0.24, 0.012, 0.17), mat: 'plasticDark' },
    { n: 6, geo: new THREE.CylinderGeometry(0.04, 0.035, 0.095, 12), mat: 'ceramic' },
    { n: 6, geo: new THREE.CylinderGeometry(0.034, 0.034, 0.21, 12), mat: 'plastic' },
    { n: 6, geo: new THREE.BoxGeometry(0.26, 0.028, 0.04), mat: 'metal' },
    { n: 8, geo: new THREE.BoxGeometry(0.13, 0.03, 0.085), mat: 'paintOrange' },
    { n: 10, geo: new THREE.SphereGeometry(0.03, 10, 8), mat: 'liquid' },
  ];
  const free = (x, y, z) => { for (const c of kit.world.colliders) { if (c.door) continue; if (y < c.y0 - 0.15 || y > c.y1 + 0.15) continue; if (c.kind === 'cyl') { if (Math.hypot(x - c.cx, z - c.cz) < c.r + 0.3) return false; } else { const dx = x - c.cx, dz = z - c.cz, lx = c.c * dx - c.s * dz, lz = c.s * dx + c.c * dz; if (Math.abs(lx) < c.hx + 0.3 && Math.abs(lz) < c.hz + 0.3) return false; } } return true; };
  const zones = [['flightdeck', 9, -0.5, 0.7], ['corridor', 8, -0.4, 0.8], ['quarters', 5, -0.5, 0.7], ['galley', 6, -0.4, 0.7], ['lab', 5, -0.4, 0.7], ['medbay', 3, -0.4, 0.7], ['core', 2, -0.4, 0.5], ['airlock', 4, -0.5, 0.7], ['cargo', 7, -0.4, 0.8], ['engineering', 6, -0.4, 0.7], ['dome', 4, 1.9, 3.1]];
  const spots = [];
  for (const [id, n, y0, y1] of zones) {
    const r = L.ROOM[id]; let tries = 0, got = 0;
    while (got < n && tries++ < 400) {
      const x = r.min[0] + 0.45 + R() * (r.max[0] - r.min[0] - 0.9), z = r.min[2] + 0.45 + R() * (r.max[2] - r.min[2] - 0.9), y = y0 + R() * (y1 - y0);
      if (id === 'flightdeck' && Math.hypot(x, y, z) < 0.6) continue;                                   // keep the pilot's eye clear
      if (id === 'dome' && Math.hypot(x - L.DOME.cx, z - L.DOME.cz) > 2.0) continue;
      if (!free(x, y, z)) continue;
      spots.push({ x, y, z }); got++;
    }
  }
  const total = kinds.reduce((a, k) => a + k.n, 0);
  const inst = kinds.map((k) => { const im = new THREE.InstancedMesh(k.geo, kit.mat(k.mat), k.n); im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; kit.root.add(im); return im; });
  const items = []; let si = 0;
  inst.forEach((im, ki) => {
    for (let i = 0; i < kinds[ki].n; i++) {
      const sp = spots[(si++) % Math.max(1, spots.length)] || { x: 0, y: 0.3, z: 6 };
      items.push({ im, i, x: sp.x, y: sp.y, z: sp.z, rx: R() * 6.28, ry: R() * 6.28, rz: R() * 6.28, wx: (R() - 0.5) * 0.35, wy: (R() - 0.5) * 0.35, wz: (R() - 0.5) * 0.25, ph: R() * 6.28, amp: 0.012 + R() * 0.03 });
    }
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new V3(), one = new V3(1, 1, 1);
  let acc = 1;
  const apply = (t) => {
    for (const it of items) { e.set(it.rx + it.wx * t, it.ry + it.wy * t, it.rz + it.wz * t); q.setFromEuler(e); p.set(it.x, it.y + Math.sin(t * 0.5 + it.ph) * it.amp, it.z); it.im.setMatrixAt(it.i, m4.compose(p, q, one)); }
    for (const im of inst) im.instanceMatrix.needsUpdate = true;
  };
  apply(0);
  kit.onUpdate((dt, t, s) => { acc += dt; if (acc < 0.066) return; acc = 0; if (s.cam.z > -4 && s.cam.z < 46) apply(t); });
  void total;
}
