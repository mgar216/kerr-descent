// Drive exhaust (dynamic): incandescent bell liner, throat glow, additive plume shells + glare sprites. Returns { update(t, s, h) }.
// h = shared heat state from drive.js: { th, bo (smoothed thrust / boost 0..1, boost already gated by thrust), idle (0..1 ember factor), fl (flicker) }.
import * as THREE from 'three';
import { AY } from './drive_util.js';

const GRAD = [[0, 1.0, 0.96, 0.85], [0.14, 1.0, 0.78, 0.45], [0.5, 1.0, 0.42, 0.12], [1, 0.52, 0.11, 0.04]];   // throat white-hot → exit deep red
function grad(f) {
  for (let i = 1; i < GRAD.length; i++) if (f <= GRAD[i][0]) { const a = GRAD[i - 1], b = GRAD[i], k = (f - a[0]) / (b[0] - a[0]); return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k]; }
  return GRAD[GRAD.length - 1].slice(1);
}

function linerTex(T) {                                   // 64 coolant tubes around (x) × ring seams along (y): modulates the vertex gradient
  const W = 512, H = 256, c = T.cvs(W, H), g = c.getContext('2d'), R = T.mulberry(0x51ce);
  g.fillStyle = '#707070'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 64; i++) { g.fillStyle = '#ffffff'; g.fillRect(i * 8 + 2, 0, 3, H); g.fillStyle = '#383838'; g.fillRect(i * 8, 0, 1, H); }
  for (let i = 0; i < 110; i++) { g.fillStyle = `rgba(0,0,0,${0.12 + R() * 0.3})`; g.fillRect(R() * W, R() * H, 2 + R() * 16, 1 + R() * 5); }
  for (const y of [38, 92, 150, 208]) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, y, W, 3); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y + 3, W, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

function throatTex(T) {                                  // injector face seen through the throat: rings, spokes, orifice dots (modulates the hot plug colour)
  const S = 256, c = T.cvs(S, S), g = c.getContext('2d'), C = S / 2;
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, S, S);
  g.lineWidth = 5; g.strokeStyle = '#3c3c3c';
  for (const r of [0.22, 0.45, 0.68, 0.9]) { g.beginPath(); g.arc(C, C, r * C, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 3;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(C + Math.cos(a) * 0.12 * C, C + Math.sin(a) * 0.12 * C); g.lineTo(C + Math.cos(a) * C, C + Math.sin(a) * C); g.stroke(); }
  g.fillStyle = '#ffffff';
  for (const [r, n] of [[0.33, 12], [0.56, 18], [0.79, 24]]) for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; g.beginPath(); g.arc(C + Math.cos(a) * r * C, C + Math.sin(a) * r * C, 4.5, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.arc(C, C, 0.1 * C, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function shellGeo(r0, r1, curve, segs = 28, rings = 14) {   // open cone shell about +Z, unit length, uv = (u along, 0.5), analytic normals
  const pos = [], nor = [], uv = [], idx = [];
  for (let j = 0; j <= rings; j++) {
    const u = j / rings, r = r0 + (r1 - r0) * Math.pow(u, curve), dr = (r1 - r0) * curve * Math.pow(Math.max(u, 1e-3), curve - 1);
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), l = Math.hypot(1, dr);
      pos.push(r * ca, r * sa, u); nor.push(ca / l, sa / l, -dr / l); uv.push(u, 0.5);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) { const a = j * (segs + 1) + i, b = a + segs + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}

function plumeMat(T, fres, fade, pulse) {                 // additive, fresnel-soft silhouette, tail fade, optional travelling ripples
  const m = new THREE.MeshBasicMaterial({ map: T.plumeTex(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  m.customProgramCacheKey = () => `drvPlume${pulse ? 1 : 0}`;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uF = { value: fres }; sh.uniforms.uFade = { value: fade }; sh.uniforms.uT = { value: 0 }; m.userData.u = sh.uniforms;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFN; varying vec3 vFV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFN = normalize(normalMatrix * normal); vFV = -(modelViewMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFN; varying vec3 vFV; uniform float uF; uniform float uFade; uniform float uT;')
      .replace('#include <map_fragment>', `#include <map_fragment>
float frs = abs(dot(normalize(vFN), normalize(vFV))); float pu = vMapUv.x;
diffuseColor.a *= pow(frs, uF) * (1.0 - smoothstep(uFade, 1.0, pu)) * smoothstep(0.0, 0.04, pu);
${pulse ? 'diffuseColor.a *= 0.84 + 0.16 * sin(pu * 64.0 - uT * 30.0);' : ''}`);
  };
  return m;
}

export default function buildPlume(kit, B) {
  const T = kit.T, eur = kit.eur, z0 = B.z0, z1 = B.z1;
  const root = kit.group('drive.fx');
  const forge = kit.mat('driveForge'), shell = kit.mat('driveShell'), cu = kit.mat('driveCopper');   // heat-soaked hardware glows red-hot under thrust

  // ───────── bell liner (inside the skin) ─────────
  const prof = B.prof(36, -0.012), P = prof.length;
  const lg = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 80), col = new Float32Array(lg.attributes.position.count * 3);
  for (let i = 0; i < col.length / 3; i++) { const c = grad((i % P) / (P - 1)); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const lm = new THREE.MeshBasicMaterial({ map: linerTex(T), vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
  kit.mesh(lg, lm, { pos: [0, AY, 0], rot: [Math.PI / 2, 0, 0], name: 'drive.liner', cast: false, receive: false, parent: root });

  // ───────── throat: hot plug disc + glow plane ─────────
  const dg = new THREE.CircleGeometry(B.r0 * 1.03, 40), dc = new Float32Array(dg.attributes.position.count * 3);
  for (let i = 0; i < dc.length / 3; i++) { const k = i === 0 ? 1 : 0.55; dc[i * 3] = 1; dc[i * 3 + 1] = k; dc[i * 3 + 2] = k * 0.7; }
  dg.setAttribute('color', new THREE.BufferAttribute(dc, 3));
  const dm = new THREE.MeshBasicMaterial({ map: throatTex(T), vertexColors: true, toneMapped: false });
  kit.mesh(dg, dm, { pos: [0, AY, z0 + 0.03], name: 'drive.throat', cast: false, receive: false, parent: root });
  const spMat = (c) => new THREE.SpriteMaterial({ map: T.glowSprite(), color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
  const sprite = (m, z, s) => { const sp = new THREE.Sprite(m); sp.position.set(0, AY, z); sp.scale.set(s, s, 1); sp.frustumCulled = false; root.add(sp); return sp; };
  const gThroat = sprite(spMat(0xffffff), z0 + 0.45, 3.6), gExit = sprite(spMat(0xffffff), z1 + 0.3, 8), gFar = sprite(spMat(0xffffff), z1 + 8, 12);

  // ───────── plume shells (not built on the derelict) ─────────
  const shells = [];
  if (!eur) {
    const defs = [   // r at nozzle → r at tail, radius law, fresnel exponent, tail-fade start, ripples, colour, gain, length fraction
      { r0: 2.0, r1: 2.9, cv: 0.8, fr: 1.4, fd: 0.2, pu: 0, c: [0.22, 0.48, 1.0], g: 1.0, lf: 1.0 },
      { r0: 1.4, r1: 0.45, cv: 1.0, fr: 1.6, fd: 0.35, pu: 1, c: [0.45, 0.88, 1.0], g: 3.0, lf: 0.85 },
      { r0: 0.8, r1: 0.06, cv: 1.0, fr: 2.0, fd: 0.5, pu: 1, c: [1.0, 1.0, 1.0], g: 6.0, lf: 0.6 },
      { r0: 0.22, r1: 0.015, cv: 1.0, fr: 1.2, fd: 0.7, pu: 0, c: [0.8, 0.95, 1.0], g: 5.0, lf: 1.7, boost: true },   // boost-only needle
    ];
    for (const d of defs) {
      const m = plumeMat(T, d.fr, d.fd, d.pu), mesh = new THREE.Mesh(shellGeo(d.r0, d.r1, d.cv), m);
      mesh.position.set(0, AY, z1 - 0.15); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 12; mesh.visible = false; root.add(mesh);
      shells.push({ d, m, mesh });
    }
  }

  const update = (t, s, h) => {
    const th = h.th, bo = h.bo, hot = Math.pow(th, 0.8), id = h.idle, fl = h.fl;
    const hs = Math.pow(th, 1.3) + 0.4 * bo;
    forge.emissive.setRGB(0.25 * hs, 0.04 * hs, 0.007 * hs); shell.emissive.setRGB(0.014 * hs, 0.002 * hs, 0); cu.emissive.setRGB(0.12 * hs, 0.025 * hs, 0.004 * hs);
    // liner + throat: faint dull-red ember at idle → white-hot gradient at full thrust / boost
    const k = id * 0.04 + 3.4 * Math.pow(th, 1.25) + 2.2 * bo;
    lm.color.setRGB(k, k * (0.28 + 0.62 * hot + 0.1 * bo), k * (0.07 + 0.7 * hot + 0.18 * bo));
    const kd = id * 0.07 + (9 + 4 * bo) * Math.pow(th, 1.2) * fl;
    dm.color.setRGB(kd, kd * (0.45 + 0.5 * hot), kd * (0.15 + 0.7 * hot));
    gThroat.material.color.setRGB(id * 0.05 + 1.0 * th * fl, id * 0.02 + 0.8 * th * fl, id * 0.01 + 0.62 * th * fl + 0.4 * bo);
    gThroat.scale.setScalar(2.8 + 0.8 * th); gThroat.visible = gThroat.material.color.r > 0.01;
    const ke = Math.pow(th, 1.3) * (0.55 + 0.35 * bo) * fl;
    gExit.material.color.setRGB(ke, ke * 0.85, ke * (0.62 + 0.4 * bo)); gExit.scale.setScalar(3.2 + 3.5 * th + 2.5 * bo); gExit.visible = ke > 0.01;
    if (shells.length) {
      const L = th > 0.004 ? 3 + 30 * Math.pow(th, 1.15) + 34 * bo : 0, w = 0.6 + 0.4 * th + 0.2 * bo;
      for (let i = 0; i < shells.length; i++) {
        const { d, m, mesh } = shells[i], on = L > 0.01 && (!d.boost || bo > 0.02);
        mesh.visible = on; if (!on) continue;
        const f2 = 1 + 0.05 * Math.sin(t * (31 + i * 7.3) + i) * Math.sin(t * 11.7 + i * 2.1);
        mesh.scale.set(w * (0.92 + 0.08 * f2), w * (0.92 + 0.08 * f2), L * d.lf);
        const kk = d.g * (d.boost ? bo : (0.12 + 0.88 * th) * (1 + 0.5 * bo)) * f2;
        m.color.setRGB(d.c[0] * kk, d.c[1] * kk, d.c[2] * kk);
        if (m.userData.u) m.userData.u.uT.value = t;
      }
      gFar.position.z = z1 + 0.25 * L; gFar.scale.setScalar(4 + 0.12 * L); const kf = 0.22 * th * (1 + bo) * fl;
      gFar.material.color.setRGB(kf * 0.5, kf * 0.75, kf); gFar.visible = L > 0.01;
    } else gFar.visible = false;
  };
  return { update };
}
