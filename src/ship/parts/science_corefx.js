// LYRA core effects (animated, mode-aware) and the dead THEA column for the derelict.
import { FL, canvasTex } from './science_util.js';
import { Y0, Y1, latticeData, buildGeometry, latticeMaterial } from './science_lattice.js';

const TINT = { normal: [0.15, 0.9, 1.0], alert: [1.0, 0.16, 0.1], emergency: [1.0, 0.42, 0.14], off: [0.15, 0.9, 1.0] };
const ring = (g, cx, cy, r0, r1, a) => { const gr = g.createRadialGradient(cx, cy, r0, cx, cy, r1); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r1, 0, 6.283); g.fill(); };

export function lyra(kit, CX, CZ) {
  const THREE = kit.THREE, R = kit.rand(0x1b7a);
  const reg = (name, o) => { kit.allMats().set(name, o); return o; };
  const data = latticeData(CX, CZ, R);
  data.struts.push([[CX, Y0, CZ], [CX, Y1, CZ], 0.012, 2, 0.3]);                                   // central spindle
  const mat = reg('sci.lattice', latticeMaterial(THREE)), geo = buildGeometry(THREE, data);
  const lat = kit.mesh(geo, mat, { name: 'lyra.lattice' }); lat.frustumCulled = false;
  // haze (soft glow volume inside the lattice)
  const hz = new THREE.CylinderGeometry(0.3, 0.3, Y1 - Y0, 28, 1, true), hp = hz.attributes.position, n = hp.count, aH = new Float32Array(n), aK = new Float32Array(n), aPh = new Float32Array(n);
  for (let i = 0; i < n; i++) { aH[i] = (hp.getY(i) + (Y1 - Y0) / 2) / (Y1 - Y0); aPh[i] = (Math.atan2(hp.getZ(i), hp.getX(i)) / 6.283 + 1) % 1; }
  hz.setAttribute('aH', new THREE.BufferAttribute(aH, 1)); hz.setAttribute('aK', new THREE.BufferAttribute(aK, 1)); hz.setAttribute('aPh', new THREE.BufferAttribute(aPh, 1));
  const hmat = reg('sci.haze', latticeMaterial(THREE, true)), haze = kit.mesh(hz, hmat, { pos: [CX, (Y0 + Y1) / 2, CZ], name: 'lyra.haze' }); haze.renderOrder = 11;
  // rotating inner rings + discs (instanced) and rising motes
  const emat = reg('sci.emit', new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 2.5), toneMapped: false })); emat.userData = { emissive: true };
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.025, 6, 56), emat, 3); rings.frustumCulled = false; kit.root.add(rings);
  const dmat = reg('sci.disc', new THREE.MeshBasicMaterial({ map: canvasTex(kit, 128, 128, (g, W, H) => { g.clearRect(0, 0, W, H); ring(g, W / 2, H / 2, W * 0.16, W * 0.5, 0.9); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, H / 2, W * 0.34, 0, 6.283); g.stroke(); }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const discs = new THREE.InstancedMesh(new THREE.CircleGeometry(0.31, 40), dmat, 2); discs.frustumCulled = false; discs.renderOrder = 11; kit.root.add(discs);
  const motes = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.012, 0), emat, 20); motes.frustumCulled = false; kit.root.add(motes);
  const mp = Array.from({ length: 20 }, () => ({ a: R() * 6.283, w: (0.4 + R() * 0.8) * (R() < 0.5 ? -1 : 1), r: 0.1 + R() * 0.22, h: R(), v: 0.04 + R() * 0.07 }));
  // floor projection ring
  const fmat = reg('sci.floor', new THREE.MeshBasicMaterial({ map: canvasTex(kit, 512, 512, (g, W, H) => { g.clearRect(0, 0, W, H); const c = W / 2; ring(g, c, c, W * 0.30, W * 0.5, 0.55); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; for (const r of [0.33, 0.45]) { g.beginPath(); g.arc(c, c, W * r, 0, 6.283); g.stroke(); } for (let i = 0; i < 48; i++) { const a = i * 6.283 / 48; g.lineWidth = i % 4 ? 2 : 4; g.beginPath(); g.moveTo(c + Math.cos(a) * W * 0.38, c + Math.sin(a) * W * 0.38); g.lineTo(c + Math.cos(a) * W * (i % 4 ? 0.405 : 0.425), c + Math.sin(a) * W * (i % 4 ? 0.405 : 0.425)); g.stroke(); } }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const floorRing = kit.mesh(new THREE.PlaneGeometry(2.6, 2.6), fmat, { pos: [CX, FL + 0.007, CZ], rot: [-Math.PI / 2, 0, 0], name: 'lyra.floor' }); floorRing.renderOrder = 11;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), tint = new THREE.Color(...TINT.normal);
  let level = 1;
  kit.onUpdate((dt, t, s) => {
    const mode = s.mode, tg = TINT[mode] || TINT.normal, tl = mode === 'off' ? 0 : mode === 'emergency' ? 0.2 : mode === 'alert' ? 0.42 + 0.4 * s.pulse : 1, k = 1 - Math.exp(-dt * 4);
    level += (tl - level) * k; tint.r += (tg[0] - tint.r) * k; tint.g += (tg[1] - tint.g) * k; tint.b += (tg[2] - tint.b) * k;
    for (const m of [mat, hmat]) { m.uniforms.uTime.value = t; m.uniforms.uLevel.value = level; m.uniforms.uTint.value.copy(tint); }
    const br = 0.85 + 0.15 * Math.sin(t * 0.95); emat.color.setRGB(tint.r * 2.4 * level * br, tint.g * 2.4 * level * br, tint.b * 2.4 * level * br);
    dmat.color.setRGB(tint.r * 0.9 * level, tint.g * 0.9 * level, tint.b * 0.9 * level); fmat.color.setRGB(tint.r * 0.8 * level * br, tint.g * 0.8 * level * br, tint.b * 0.8 * level * br);
    [[0.17, 0.12, 0.35, 0.9, 0.5], [0.23, 0.0, 0.1, -0.6, 0.9], [0.29, -0.15, -0.4, 0.4, -0.7]].forEach(([r, y, tx, w, tz], i) => {
      p.set(CX, 0.05 + y + Math.sin(t * 0.5 + i) * 0.04, CZ); e.set(tx + Math.sin(t * 0.3 + i) * 0.15, t * w, tz); q.setFromEuler(e); sc.setScalar(r); rings.setMatrixAt(i, m4.compose(p, q, sc));
    });
    rings.instanceMatrix.needsUpdate = true;
    [[-0.45, 0.25], [0.6, -0.2]].forEach(([y, w], i) => { p.set(CX, y + Math.sin(t * 0.4 + i * 2) * 0.05, CZ); e.set(-Math.PI / 2 + Math.sin(t * 0.3 + i) * 0.06, 0, t * w); q.setFromEuler(e); sc.setScalar(1 + 0.04 * Math.sin(t + i)); discs.setMatrixAt(i, m4.compose(p, q, sc)); });
    discs.instanceMatrix.needsUpdate = true;
    mp.forEach((m, i) => { const a = m.a + t * m.w, h = (m.h + t * m.v) % 1; p.set(CX + Math.cos(a) * m.r, Y0 + 0.05 + h * (Y1 - Y0 - 0.1), CZ + Math.sin(a) * m.r); sc.setScalar(0.6 + 0.8 * Math.sin(h * 3.14159)); motes.setMatrixAt(i, m4.compose(p, q.identity(), sc)); });
    motes.instanceMatrix.needsUpdate = true;
  });
}

// ───────── derelict: dead THEA column ─────────
export function thea(kit, CX, CZ) {
  const THREE = kit.THREE, R = kit.rand(0x7ea);
  const data = latticeData(CX, CZ, R);
  const dS = data.struts.map(() => { const r = R(); return r < 0.13 ? 1 : r < 0.24 ? 2 : 0; }), dN = data.nodes.map(() => (R() < 0.1 ? 1 : 0));
  const geo = buildGeometry(THREE, data, { drop: (i) => (i >= 0 ? dS[i] : dN[-1 - i]) }); geo.computeVertexNormals(); kit.add('darkMetal', geo); geo.dispose();
  // a few surviving nodes that still flicker (amber / cold white)
  const live = data.nodes.filter((n, i) => !dN[i]), pick = (a, b) => live.filter((_, i) => i % 11 === a || i % 17 === b).slice(0, 5);
  const mk = (list, col) => { const g = buildGeometry(THREE, { struts: [], nodes: list.map((n) => [n[0], 1, 0]) }); const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), toneMapped: false }); m.userData = { emissive: true }; kit.allMats().set('sci.' + col[0], m); kit.mesh(g, m, { name: 'thea.nodes' }); return m; };
  const mA = mk(pick(2, 5), [1.0, 0.5, 0.12]), mW = mk(pick(7, 3), [0.7, 0.85, 1.0]);
  kit.onUpdate((dt, t, s) => {
    const off = s.mode === 'off' ? 0 : 1, a = Math.max(0, Math.sin(t * 6.1) * Math.sin(t * 1.7 + 0.5)) * s.flicker * off, w = Math.max(0, Math.sin(t * 9.3 + 2) * Math.sin(t * 2.9)) * (s.flicker > 0.5 ? 1 : 0.2) * off;
    mA.color.setRGB(1.0 * a * 1.4, 0.5 * a * 1.4, 0.12 * a * 1.4); mW.color.setRGB(0.7 * w * 1.1, 0.85 * w * 1.1, 1.0 * w * 1.1);
  });
  // inner works: snapped spindle, rings fallen askew
  kit.cyl('darkMetal', [CX, Y0 + 0.45, CZ], 0.012, 0.9, { seg: 6 }); kit.beam('darkMetal', [CX, Y0 + 0.9, CZ], [CX + 0.2, Y0 + 1.25, CZ + 0.12], 0.02, 0.02, { bev: 0.004 });
  kit.torus('darkMetal', [CX, Y0 + 0.1, CZ], 0.3, 0.012, { seg: 32, tube: 5, rot: [1.2, 0.3, 0.2] }); kit.torus('trim', [CX + 0.02, Y0 + 0.35, CZ - 0.04], 0.22, 0.01, { seg: 28, tube: 5, rot: [0.5, 0.2, 0.9] });
  kit.torus('darkMetal', [CX - 0.06, Y0 + 0.07, CZ + 0.05], 0.17, 0.01, { seg: 24, tube: 5, rot: [1.5, 0.0, 0.1] });
  // dangling cables from the collar, frayed ends
  for (let i = 0; i < 6; i++) { const a = R() * 6.283, r = 0.3 + R() * 0.25, len = 0.5 + R() * 1.0, x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r;
    kit.tube('rubber', [[x, Y1 + 0.1, z], [x + (R() - 0.5) * 0.15, Y1 - len * 0.4, z + (R() - 0.5) * 0.15], [x + (R() - 0.5) * 0.3, Y1 - len, z + (R() - 0.5) * 0.3]], 0.012, { rseg: 5 });
    if (i % 2) kit.box(kit.led('Amber', 'Rand'), [x + (R() - 0.5) * 0.3, Y1 - len - 0.01, z + (R() - 0.5) * 0.3], [0.012, 0.012, 0.012], { bev: 0 }); }
  // scorch at the base
  const tex = canvasTex(kit, 256, 256, (g, W, H) => { g.clearRect(0, 0, W, H); const gr = g.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.5); gr.addColorStop(0, 'rgba(6,5,4,0.95)'); gr.addColorStop(0.55, 'rgba(10,8,7,0.7)'); gr.addColorStop(1, 'rgba(14,12,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); const r2 = kit.rand(0x5c0); for (let i = 0; i < 14; i++) { g.save(); g.translate(W / 2, H / 2); g.rotate(r2() * 6.283); g.fillStyle = `rgba(8,6,5,${0.3 + r2() * 0.4})`; g.fillRect(W * 0.1, -4 - r2() * 6, W * (0.2 + r2() * 0.25), 6 + r2() * 12); g.restore(); } });
  kit.decal(tex, [CX, FL + 0.006, CZ], [2.2, 2.2], { rot: [-Math.PI / 2, 0, 0], opacity: 0.92, name: 'thea.scorch' });
  for (let i = 0; i < 5; i++) kit.box('sciSoot', [CX - 0.5 - 0.005, FL + 0.12, CZ - 0.25 + i * 0.12], [0.012, 0.18 + R() * 0.07, 0.07], { bev: 0, yaw: 0 });
}
