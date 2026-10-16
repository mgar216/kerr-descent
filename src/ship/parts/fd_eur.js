// EURYDICE flight deck dressing (variant 'eurydice' only): log recorder, tablet + coffee bulb, cracked screen, scorch streak,
// drifting harness straps, hanging overhead cover with exposed wiring. (Frost, dead screens, flicker, debris come from kit/derelict.)
import * as THREE from 'three';

const PI = Math.PI;
export default function build(kit, U) {
  if (!kit.eur) return;
  const { box, cyl, sph, tube, at, led } = U, T = kit.T, SB = U.sb.W, DESK = U.sb.DESK, R = kit.rand(0xe0f1);
  const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

  // ── log recorder on the systems console (wrist-rest zone) ──
  { const [x, z] = SB.pt(-0.47, 0.185); kit.recorder(1, [x, DESK + 0.025, z], SB.yaw); }
  // ── tablet left on the desk + coffee bulb ──
  {
    const TOP = at(SB.fr(-0.47, 0, 0), [0, DESK, 0], { rot: [-PI / 2, 0, 0] }), TB = at(TOP, [-0.41, -0.12, 0.0], { rot: [0, 0, 0.35] });
    box(TB, 'plasticDark', [0, 0, 0.007], [0.2, 0.14, 0.012], { bev: 0.006 }); box(TB, 'screenOff', [0, 0, 0.0135], [0.18, 0.12, 0.003], { bev: 0 }); box(TB, 'trim', [0.075, 0.03, 0.0148], [0.04, 0.003, 0.0012], { rot: [0, 0, 0.5], bev: 0 });
    led(TB, [-0.085, -0.055, 0.0135], 'Amber', 'Blink', 0.007);
    sph(TOP, 'glassMed', [-0.27, -0.17, 0.045], 0.045, { seg: 14 }); sph(TOP, 'leather', [-0.27, -0.17, 0.04], 0.038, { seg: 12 }); cyl(TOP, 'plastic', [-0.27, -0.17, 0.095], 0.017, 0.022, { axis: 'z', seg: 10 });
    tube(TOP, 'plastic', [[-0.27, -0.17, 0.105], [-0.285, -0.19, 0.14], [-0.31, -0.2, 0.15]], 0.004, { seg: 8 }); box(TOP, 'paintOrange', [-0.27, -0.17, 0.0115], [0.05, 0.012, 0.004], { bev: 0.001 });
  }
  // ── cracked glass over the POWER screen ──
  {
    const cv = T.cvs(256, 160), g = cv.getContext('2d'); g.clearRect(0, 0, 256, 160); g.lineCap = 'round';
    const cx = 150, cy = 62;
    for (let k = 0; k < 15; k++) {
      let a = (k / 15) * PI * 2 + R() * 0.3, x = cx, y = cy, r = 0; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { r = 10 + R() * 40; a += (R() - 0.5) * 0.5; x += Math.cos(a) * r; y += Math.sin(a) * r; g.lineTo(x, y); }
      g.strokeStyle = `rgba(225,238,255,${0.45 + R() * 0.4})`; g.lineWidth = 0.8 + R() * 1.4; g.stroke();
    }
    for (const rr of [14, 30, 52]) { g.beginPath(); for (let i = 0; i <= 18; i++) { const a = i / 18 * PI * 2, q = rr * (0.85 + R() * 0.3); g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q * 0.8); } g.strokeStyle = 'rgba(225,238,255,0.35)'; g.lineWidth = 1; g.stroke(); }
    const [x, z] = SB.pt(-0.47, 0.12); kit.decal(tex(cv), [x, -0.2, z], [0.34, 0.21], { rot: [0, SB.yaw, 0], color: 0xa8b4c4, name: 'crack.fd' });
  }
  // ── soot streak above the systems console ──
  {
    const cv = T.cvs(128, 256), g = cv.getContext('2d'); g.clearRect(0, 0, 128, 256);
    for (let i = 0; i < 40; i++) {
      const yy = 250 - i * 6, w = 14 + R() * 26 * (1 - i / 60), x = 64 + (R() - 0.5) * 30 * (1 + i / 30), a = 0.5 * (1 - i / 44);
      const gr = g.createRadialGradient(x, yy, 0, x, yy, w); gr.addColorStop(0, `rgba(6,5,4,${a})`); gr.addColorStop(1, 'rgba(10,8,7,0)'); g.fillStyle = gr; g.fillRect(x - w, yy - w, w * 2, w * 2);
    }
    const [x, z] = SB.pt(-0.45, 0.004); kit.decal(tex(cv), [x, 0.78, z], [0.7, 0.62], { rot: [0, SB.yaw, 0], opacity: 0.9, name: 'scorch.fd' });
  }
  // ── hanging overhead cover + exposed wires ──
  {
    const OV = U.ov.F, Z = U.ov.Z;
    box(OV, 'fdShell', [-0.3 + 0.0, -0.345, Z + 0.09], [0.26, 0.2, 0.012], { rot: [1.15, 0, 0.08], bev: 0.004 }); cyl(OV, 'steel', [-0.3, -0.39, Z + 0.004], 0.006, 0.28, { axis: 'x', seg: 6 });
    for (let i = 0; i < 6; i++) { const x = -0.4 + i * 0.04; tube(OV, i % 2 ? 'paintCyan' : 'paintOrange', [[x, -0.3, Z], [x + (R() - 0.5) * 0.03, -0.29 + R() * 0.03, Z + 0.1], [x + (R() - 0.5) * 0.08, -0.28 + R() * 0.08, Z + 0.2 + R() * 0.12]], 0.004, { seg: 10 }); }
  }
  // ── drifting shoulder straps (pilot seat): a single wavering ribbon mesh ──
  {
    kit.defMat('fdWebbingDS', { tex: T.fabric, uv: 'own', rough: 1, metal: 0, color: 0x8a5a38, doubleSide: true });
    const N = 10, strips = 2, g = new THREE.BufferGeometry(), pos = new Float32Array(strips * 2 * (N + 1) * 3), uv = new Float32Array(strips * 2 * (N + 1) * 2), idx = [];
    for (let k = 0; k < strips; k++) for (let i = 0; i <= N; i++) { const b = (k * (N + 1) + i) * 2; uv.set([0, i * 0.5, 0.35, i * 0.5], b * 2); if (i < N) idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const mesh = kit.mesh(g, 'fdWebbingDS', { pos: [0, 0.2976, 0.4483], name: 'fd.straps' }); mesh.frustumCulled = false; mesh.castShadow = false;
    const upd = (t) => {
      for (let k = 0; k < strips; k++) {
        const sx = k ? 1 : -1;
        for (let i = 0; i <= N; i++) {
          const s = i / N, w = 0.5 * s * s * 0.06;
          const cx = sx * (0.225 + 0.13 * s) + Math.sin(t * 0.7 + 5 * s + k * 2) * w, cy = 0.04 * Math.sin(s * 3) - 0.22 * s * s + Math.cos(t * 0.9 + 3 * s + k) * w, cz = -0.4 * s + Math.sin(t * 0.5 + 2 * s) * w;
          const b = (k * (N + 1) + i) * 2;
          pos.set([cx - 0.025, cy, cz], b * 3); pos.set([cx + 0.025, cy, cz], (b + 1) * 3);
        }
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals();
    };
    upd(0); mesh.geometry.computeBoundingSphere();
    kit.onUpdate((dt, t, s) => { if (s.cam.z > -3 && s.cam.z < 5) upd(t); });
  }
}
