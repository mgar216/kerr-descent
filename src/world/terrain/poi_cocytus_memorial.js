// ORPHEUS · Cocytus / The Frozen Lake (slot `memorial`, padR 10) — the EURYDICE memorial, built by Halcyon's crew and dedicated by Director Arthur Bell.
// A tapered obelisk of dark polished glass (faceted crown, fresnel sheen) with the names etched as softly glowing engraving, a stepped dark-stone plinth crusted with frost,
// a ring of ten low warm lamps set in the ice (one shared PointLight), and the offerings visitors have left. Quiet, dignified; the only motion is the lamplight breathing.
import * as THREE from 'three';
import { GM, makeFrame, makeBatch, brushedTexture, rbox, groundPatch, mergeAll, obbBoxes } from './poi_charon_icekit.js';
import { makeFrost, icicleRow, addIcicles } from './poi_cocytus_frost.js';

const PLINTH = [{ w: 5.0, h: 0.30, y: 0.0 }, { w: 3.7, h: 0.32, y: 0.30 }, { w: 2.5, h: 0.42, y: 0.62 }];   // top at 1.04
const OB = { y0: 1.04, hw0: 0.52, hw1: 0.30, H1: 4.2, hw2: 0.06, H2: 4.8 };
const SERIF = '"Cinzel", "Trajan Pro", "Palatino Linotype", "Book Antiqua", Georgia, "Times New Roman", serif';

/** flat-shaded tapered obelisk: square shaft (hw0 → hw1 over H1) + faceted pyramidion to a small flat tip */
function obeliskGeo() {
  const pos = [], nor = [], uv = [], idx = [], { hw0, hw1, H1, hw2, H2 } = OB;
  const ring = (hw, y) => [[-hw, y, -hw], [hw, y, -hw], [hw, y, hw], [-hw, y, hw]], R = [ring(hw0, 0), ring(hw1, H1), ring(hw2, H2)];
  const quad = (a, b, c, d, top) => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const cx = (a[0] + b[0] + c[0] + d[0]) / 4, cz = (a[2] + b[2] + c[2] + d[2]) / 4, fl = top ? n[1] < 0 : n[0] * cx + n[2] * cz < 0, l = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((q) => q / l * (fl ? -1 : 1));
    const base = pos.length / 3; for (const p of [a, b, c, d]) { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); }
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    if (!fl) idx.push(base, base + 1, base + 2, base, base + 2, base + 3); else idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };
  for (let k = 0; k < 2; k++) for (let s = 0; s < 4; s++) quad(R[k][s], R[k][(s + 1) % 4], R[k + 1][(s + 1) % 4], R[k + 1][s], false);
  quad(R[2][0], R[2][1], R[2][2], R[2][3], true);                              // flat tip
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

/**
 * 512×512 etching atlas: names block (rows 0–191) + ship / registry / lyre block (rows 192–511). Soft halo + crisp core, drawn for additive blending.
 */
function etchTexture(kit) {
  return kit.canvasTexture(512, 512, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const glowText = (s, x, y, px, wgt, ls, maxW = 452) => {
      g.font = `${wgt} ${px}px ${SERIF}`; try { g.letterSpacing = ls + 'px'; } catch { /* optional */ }
      const tw = g.measureText(s).width; if (tw > maxW) { px *= maxW / tw; ls *= maxW / tw; g.font = `${wgt} ${px}px ${SERIF}`; try { g.letterSpacing = ls + 'px'; } catch { /* optional */ } }
      g.shadowColor = 'rgba(255,222,170,0.95)'; g.shadowBlur = 11; g.fillStyle = 'rgba(255,238,210,0.55)'; g.fillText(s, x, y); g.fillText(s, x, y);
      g.shadowBlur = 0; g.shadowColor = 'transparent'; g.fillStyle = '#f3f6fb'; g.fillText(s, x, y);
      try { g.letterSpacing = '0px'; } catch { /* optional */ }
    };
    glowText('ELENA VARIS', W / 2, 48, 56, 600, 5);
    g.strokeStyle = 'rgba(243,246,251,0.7)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(W / 2 - 26, 96); g.lineTo(W / 2 - 8, 96); g.moveTo(W / 2 + 8, 96); g.lineTo(W / 2 + 26, 96); g.stroke();
    g.fillStyle = 'rgba(243,246,251,0.9)'; g.beginPath(); g.arc(W / 2, 96, 3, 0, 7); g.fill();
    glowText('TOMAS OYELARAN', W / 2, 146, 56, 600, 3);
    glowText('EURYDICE', W / 2, 192 + 45, 70, 600, 10);
    g.strokeStyle = 'rgba(243,246,251,0.55)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(W / 2 - 150, 192 + 86); g.lineTo(W / 2 + 150, 192 + 86); g.stroke();
    glowText('HX-01', W / 2, 192 + 118, 38, 600, 12);
    g.save(); g.translate(W / 2, 192 + 300); const s = 64;                       // lyre emblem (baseline at the bottom of the block)
    g.shadowColor = 'rgba(255,222,170,0.95)'; g.shadowBlur = 9; g.strokeStyle = '#f3f6fb'; g.lineWidth = 2.8; g.lineCap = 'round'; g.lineJoin = 'round';
    const L = (x, y) => [x * s, -y * s];
    for (const k of [-1, 1]) {
      g.beginPath(); g.moveTo(...L(k * 0.5, 0.3)); g.bezierCurveTo(...L(k * 1.15, 0.55), ...L(k * 1.1, 1.25), ...L(k * 0.62, 1.7)); g.stroke();
      g.beginPath(); g.moveTo(...L(k * 0.5, 0.3)); g.quadraticCurveTo(...L(k * 0.55, 0.05), ...L(k * 0.28, 0.0)); g.stroke();
    }
    g.beginPath(); g.moveTo(...L(-0.28, 0.0)); g.lineTo(...L(0.28, 0.0)); g.stroke();
    g.beginPath(); g.moveTo(...L(-0.7, 1.66)); g.lineTo(...L(0.7, 1.66)); g.stroke();
    g.lineWidth = 1.4; for (let i = 0; i < 7; i++) { const x = -0.42 + i * 0.14; g.beginPath(); g.moveTo(...L(x * 0.9, 0.34)); g.lineTo(...L(x, 1.62)); g.stroke(); }
    g.beginPath(); g.arc(0, -0.17 * s, 0.1 * s, 0, 7); g.stroke();
    g.restore();
  }, { wrap: false, aniso: 8 });
}

function plaqueTexture(kit) {
  return kit.canvasTexture(512, 112, (g, W, H) => {
    const r = kit.mulberry32(77);
    g.fillStyle = '#6a5a3c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 200; i++) { g.fillStyle = r() > 0.5 ? `rgba(255,236,190,${0.03 + r() * 0.07})` : `rgba(0,0,0,${0.04 + r() * 0.08})`; g.fillRect(0, r() * H, W, 0.6 + r() * 1.4); }
    g.strokeStyle = 'rgba(20,14,6,0.7)'; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12);
    g.textAlign = 'center'; g.textBaseline = 'middle'; try { g.letterSpacing = '2.5px'; } catch { /* optional */ }
    for (const [s, y, px] of [['ERECTED BY THE CREW OF HALCYON STATION', 38, 22], ['DEDICATED BY DIRECTOR ARTHUR BELL', 76, 19]]) {
      g.font = `600 ${px}px ${SERIF}`; const tw = g.measureText(s).width; if (tw > W - 44) { g.font = `600 ${px * (W - 44) / tw}px ${SERIF}`; }
      g.fillStyle = 'rgba(255,240,200,0.5)'; g.fillText(s, W / 2 + 1, y + 1.2); g.fillStyle = '#1e160a'; g.fillText(s, W / 2, y);
    }
  }, { wrap: false, aniso: 8 });
}

const graniteTexture = (kit) => kit.canvasTexture(256, 256, (g, W, H) => {
  const r = kit.mulberry32(41);
  g.fillStyle = '#9aa0a8'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1300; i++) { const l = r(); g.fillStyle = l > 0.7 ? `rgba(255,255,255,${0.12 + r() * 0.2})` : l > 0.35 ? `rgba(0,0,0,${0.12 + r() * 0.2})` : `rgba(130,150,175,${0.1 + r() * 0.15})`; g.fillRect(r() * W, r() * H, 0.8 + r() * 2.2, 0.8 + r() * 2.2); }
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(r() * W, 0); g.bezierCurveTo(r() * W, H * 0.3, r() * W, H * 0.7, r() * W, H); g.stroke(); }
}, { aniso: 8 });

const photoTexture = (kit) => kit.canvasTexture(96, 128, (g, W, H) => {
  const sky = g.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, '#2a3d73'); sky.addColorStop(0.55, '#c8704a'); sky.addColorStop(1, '#f2b46a'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f7d79a'; g.beginPath(); g.arc(W * 0.72, H * 0.52, 9, 0, 7); g.fill();
  const lake = g.createLinearGradient(0, H * 0.62, 0, H); lake.addColorStop(0, '#8d6a6a'); lake.addColorStop(1, '#1b2a44'); g.fillStyle = lake; g.fillRect(0, H * 0.62, W, H * 0.38);
  g.fillStyle = '#10141f';
  for (const [x, s] of [[W * 0.36, 1], [W * 0.5, 0.92]]) { g.beginPath(); g.arc(x, H * 0.5 - 5 * s, 5.2 * s, 0, 7); g.fill(); g.fillRect(x - 6.5 * s, H * 0.5, 13 * s, 30 * s); }
  g.strokeStyle = '#10141f'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(W * 0.4, H * 0.58); g.lineTo(W * 0.46, H * 0.58); g.stroke();
  g.fillStyle = 'rgba(255,240,210,0.08)'; g.fillRect(0, 0, W, H);
}, { wrap: false, aniso: 4 });

const poolTexture = (kit) => kit.canvasTexture(64, 64, (g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#9a9a9a'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }, { wrap: false, aniso: 1 });

export function buildMemorial(env, slot) {
  const { kit } = env, fr = makeFrame(env, slot), group = new THREE.Group(); group.name = 'eurydice_memorial';
  const rng = kit.rng('memorial'), colliders = [], updaters = [];
  const { frostify } = makeFrost();
  const S = (o) => kit.std({ color: 0xffffff, ...o });
  const gl = (x, z) => fr.gy(x, z) - fr.y0;

  const mat = {
    stone: frostify(S({ map: graniteTexture(kit), vertexColors: true, roughness: 0.4, metalness: 0.12 }), { amount: 0.85, bias: -0.12, rough: 0.6, sparkle: 0.16 }),
    bronze: frostify(S({ map: brushedTexture(kit, { dir: 'u', base: '#b08a4a' }), vertexColors: true, roughness: 0.4, metalness: 0.7 }), { amount: 0.6 }),
    offer: frostify(S({ vertexColors: true, roughness: 0.7, metalness: 0.02 }), { amount: 0.7, bias: -0.1 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
    ice: S({ color: 0xe0f2fc, roughness: 0.14, transparent: true, opacity: 0.88, emissive: 0x0c2236 }),
    glass: S({ color: 0x06080c, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.7 }),
    etch: new THREE.MeshBasicMaterial({ map: etchTexture(kit), color: new THREE.Color(1.5, 1.5, 1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    halo: new THREE.MeshBasicMaterial({ map: poolTexture(kit), color: new THREE.Color(0.42, 0.23, 0.09), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  };
  {                                                                             // obelisk: fresnel sheen (a sky-reflection stand-in that also works without an envMap)
    const prev = mat.glass.onBeforeCompile, key = mat.glass.customProgramCacheKey ? mat.glass.customProgramCacheKey() : '';
    mat.glass.onBeforeCompile = (shader, renderer) => {
      if (prev) prev.call(mat.glass, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float oFr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0); totalEmissiveRadiance += vec3(0.05, 0.085, 0.16) * oFr * 1.6;');
    };
    mat.glass.customProgramCacheKey = () => key + '|obFresnel'; mat.glass.needsUpdate = true;
  }
  const ST = makeBatch(fr), BZ = makeBatch(fr), OFF = makeBatch(fr), G = makeBatch(fr), ICE = makeBatch(fr);
  const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg), sph = (r, a = 10, b = 7) => GM.Sphere(r, a, b);

  // ── plinth: three dark-stone steps, plaque on the top step ──
  PLINTH.forEach((s, i) => ST.add(rbox(s.w, s.h, s.w, 0.04), { p: [0, s.y + s.h / 2, 0], color: [0x3a4047, 0x353b42, 0x30363c][i], uv: 0.6 }));
  ST.add(rbox(1.5, 0.12, 1.5, 0.03), { p: [0, OB.y0 + 0.06, 0], color: 0x2c3238, uv: 0.6 });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.33), S({ map: plaqueTexture(kit), roughness: 0.42, metalness: 0.55 })); fr.place(plaque, 0, 0.83, 1.25 + 0.006); plaque.castShadow = false; group.add(plaque);
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) BZ.add(cyl(0.014, 0.014, 0.012, 8), { p: [sx * 0.72, 0.83 + sy * 0.13, 1.25 + 0.004], r: [Math.PI / 2, 0, 0], color: 0x8a6a30 });

  // ── obelisk of dark polished glass + glowing etched text on its +Z face ──
  const obMesh = new THREE.Mesh(obeliskGeo(), mat.glass); fr.place(obMesh, 0, OB.y0, 0); obMesh.castShadow = true; obMesh.receiveShadow = true; group.add(obMesh);
  const slope = (OB.hw0 - OB.hw1) / OB.H1, zAt = (y) => OB.hw0 - slope * y;
  {
    const PW = 0.7, plane = (ty, th, yc) => {
      const g = new THREE.PlaneGeometry(PW, PW * th / 512), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - (ty + (1 - uv.getY(i)) * th) / 512);
      return g.rotateX(-Math.atan(slope)).translate(0, OB.y0 + yc, zAt(yc) + 0.004);
    };
    const etch = new THREE.Mesh(mergeAll([plane(0, 192, 2.35), plane(192, 320, 1.52)]), mat.etch); etch.renderOrder = 4; etch.castShadow = false; fr.place(etch, 0, 0, 0); group.add(etch);
  }

  // ── lamp ring: 10 low warm lamps set in the ice, soft pools of light, one shared PointLight ──
  const LAMPS = 10, LR = 4.35, lampPos = [], haloParts = [];
  for (let i = 0; i < LAMPS; i++) {
    const a = (i + 0.5) / LAMPS * Math.PI * 2, x = Math.sin(a) * LR, z = Math.cos(a) * LR, g0 = gl(x, z), k = 0.9 + 0.2 * rng();
    BZ.add(cyl(0.17, 0.2, 0.08, 14), { p: [x, g0 + 0.02, z], color: 0x6a5230 });
    BZ.add(cyl(0.085, 0.105, 0.3, 12), { p: [x, g0 + 0.2, z], color: 0xb08a4a });
    BZ.add(cyl(0.115, 0.09, 0.05, 12), { p: [x, g0 + 0.365, z], color: 0x8a6a30 });
    G.add(sph(0.095, 12, 8), { p: [x, g0 + 0.425, z], color: [4.6 * k, 2.55 * k, 0.95 * k], uv: 0 });
    haloParts.push(groundPatch(fr, x, z, 2.2, 2.2, 0, 4, 4, 0.035));
    lampPos.push([x, g0, z]);
  }
  const lamp = kit.pointLight(0xffb06a, 15, 15, [0, 0, 0]); lamp.position.copy(fr.pos(0, 1.15, 3.1)); group.add(lamp);
  const halo = new THREE.Mesh(mergeAll(haloParts), mat.halo); halo.castShadow = false; halo.renderOrder = 3; group.add(halo);

  // ── offerings on the lowest step ──
  {
    const sy = PLINTH[0].h, at = (x, z, yaw, lx, lz) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    {                                                                           // an orange work glove with a dark cuff
      const x = -1.35, z = 2.12, y = sy + 0.014, yaw = 0.5;
      OFF.add(rbox(0.1, 0.03, 0.11, 0.012), { p: [x, y, z], r: [0, yaw, 0], color: 0xd9792b });
      for (let i = 0; i < 4; i++) { const q = at(x, z, yaw, -0.036 + i * 0.024, -0.1); OFF.add(cyl(0.012, 0.011, 0.085 - Math.abs(i - 1.5) * 0.006, 6), { p: [q[0], y, q[1]], r: [Math.PI / 2, yaw + (i - 1.5) * 0.08, 0], color: 0xd9792b, uv: 0 }); }
      { const q = at(x, z, yaw, 0.065, -0.035); OFF.add(cyl(0.014, 0.012, 0.06, 6), { p: [q[0], y, q[1]], r: [Math.PI / 2, yaw + 0.9, 0], color: 0xd9792b, uv: 0 }); }
      { const q = at(x, z, yaw, 0, 0.085); OFF.add(cyl(0.052, 0.056, 0.05, 10), { p: [q[0], y + 0.004, q[1]], r: [Math.PI / 2, yaw, 0], color: 0x2a2d32, uv: 0 }); }
    }
    {                                                                           // photo frame leaning on the step
      const x = -0.5, z = 1.96, y = sy;
      OFF.add(rbox(0.17, 0.22, 0.016, 0.005), { p: [x, y + 0.105, z], r: [-0.3, 0.1, 0], color: 0x4a3626 });
      const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.172), S({ map: photoTexture(kit), roughness: 0.5 })); fr.place(ph, x + 0.001, y + 0.108, z + 0.0095, 0.1); ph.rotation.order = 'YXZ'; ph.rotation.x = -0.3; ph.castShadow = false; group.add(ph);
    }
    {                                                                           // pressed flower under a glass dome
      const x = 0.12, z = 2.18, y = sy;
      OFF.add(cyl(0.085, 0.09, 0.022, 18), { p: [x, y + 0.011, z], color: 0x5a4028, uv: 0 });
      OFF.add(cyl(0.004, 0.005, 0.1, 5), { p: [x, y + 0.075, z], color: 0x3c7a3a, uv: 0 });
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; OFF.add(sph(0.02, 8, 5), { p: [x + Math.sin(a) * 0.018, y + 0.125, z + Math.cos(a) * 0.018], s: [1, 0.55, 1], r: [0.4 * Math.cos(a), 0, 0.4 * Math.sin(a)], color: i % 2 ? 0xc43a52 : 0xdd5a6a, uv: 0 }); }
      OFF.add(sph(0.014, 8, 6), { p: [x, y + 0.13, z], color: 0xe8c040, uv: 0 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.078, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), kit.glass({ opacity: 0.3, color: 0xcfe4ee })); fr.place(dome, x, y + 0.022, z, 0); dome.castShadow = false; group.add(dome);
    }
    {                                                                           // a mug
      const x = 0.52, z = 2.22, y = sy;
      OFF.add(cyl(0.05, 0.046, 0.105, 16), { p: [x, y + 0.0525, z], color: 0xdfe6ea, uv: 0 });
      OFF.add(cyl(0.051, 0.051, 0.024, 16), { p: [x, y + 0.064, z], color: 0x2e5aa0, uv: 0 });
      OFF.add(cyl(0.042, 0.042, 0.004, 16), { p: [x, y + 0.104, z], color: 0x3a2a20, uv: 0 });
      OFF.add(GM.Torus(0.029, 0.008, 6, 12, Math.PI), { p: [x + 0.05, y + 0.054, z], r: [0, 0, -Math.PI / 2], color: 0xdfe6ea, uv: 0 });
    }
    {                                                                           // a folded paper crane
      const x = -0.05, z = 2.3, y = sy + 0.002, cr = [0xf4f0e6, 0xe4dfd2];
      const tri = (a, b, c, col) => {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); g.computeVertexNormals();
        OFF.add(g, { p: [x, y, z], r: [0, 0.6, 0], color: col, uv: 0 });
        const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...c, ...b], 3)); g2.computeVertexNormals();
        OFF.add(g2, { p: [x, y, z], r: [0, 0.6, 0], color: col, uv: 0 });
      };
      tri([0, 0.015, 0.045], [0, 0.015, -0.045], [0, 0.05, 0], cr[0]); tri([0, 0.015, 0.045], [0.07, 0.055, 0], [0, 0.015, -0.045], cr[1]); tri([0, 0.015, 0.045], [-0.07, 0.055, 0], [0, 0.015, -0.045], cr[0]);
      tri([0, 0.02, 0.045], [0, 0.07, 0.07], [0, 0.015, 0.03], cr[1]); tri([0, 0.015, -0.045], [0, 0.04, -0.09], [0, 0.02, -0.03], cr[0]);
    }
    {                                                                           // rolled blue scarf with fringe, folded note, LED candle jar, small stones
      const x = 0.95, z = 2.12, yaw = -0.3;
      OFF.add(rbox(0.2, 0.05, 0.075, 0.02), { p: [x, sy + 0.025, z], r: [0, yaw, 0], color: 0x2a4f9a });
      for (let i = 0; i < 6; i++) { const q = at(x, z, yaw, 0.115, (i - 2.5) * 0.012); OFF.add(cyl(0.0045, 0.0045, 0.045, 5), { p: [q[0], sy + 0.02, q[1]], r: [0, yaw, Math.PI / 2], color: 0xe8d8b0, uv: 0 }); }
      OFF.add(GM.Box(0.1, 0.003, 0.14), { p: [-0.9, sy + 0.002, 2.3], r: [0, 0.35, 0], color: 0xece6d6, uv: 0 });
      OFF.add(cyl(0.03, 0.03, 0.07, 12), { p: [-0.78, sy + 0.035, 2.0], color: 0xcfe0ea, uv: 0 });
      G.add(sph(0.014, 8, 6), { p: [-0.78, sy + 0.062, 2.0], color: [7, 4.2, 1.6], uv: 0 });
      for (let i = 0; i < 5; i++) OFF.add(sph(0.03 + 0.012 * (i % 3), 7, 5), { p: [-1.7 + i * 0.07, sy + 0.015, 2.05 + (i % 2) * 0.06], s: [1, 0.6, 1], color: [0x6a6c70, 0x8a8c90, 0x585a5e][i % 3], uv: 0 });
    }
  }

  // ── recorder on the plinth step (log.cocytus.2) ──
  const rec = kit.recorder({ title: 'FLIGHT DIR.', sub: 'A. BELL', accent: '#ffc870', scale: 1.3 });
  fr.place(rec, 1.55, PLINTH[0].h + 0.79, 2.12, -0.35); group.add(rec);

  // ── icicles hanging from the lamp heads ──
  { const list = []; for (const [x, g0, z] of lampPos) icicleRow([x - 0.09, g0 + 0.34, z], [x + 0.09, g0 + 0.34, z], 14, 0.03, 0.11, rng, list); addIcicles(ICE, list, rng); }

  // ── beacon at the apex: a slow warm pulse, like a held breath ──
  const beacon = kit.beacon(fr.pos(0, OB.y0 + OB.H2 + 0.12, 0).toArray(), { color: 0xffe2b4, size: 0.06, range: 20, lightI: 7, period: 5.2, duty: 0.55 });
  group.add(beacon.group);

  // ── flush ──
  for (const [b, m, cast] of [[ST, mat.stone, true], [BZ, mat.bronze, true], [OFF, mat.offer, true], [ICE, mat.ice, false]]) { const mesh = b.build(m, { cast }); if (mesh) group.add(mesh); }
  const gm = G.build(mat.glow, { cast: false, receive: false }); if (gm) group.add(gm);

  colliders.push(...obbBoxes(fr, 0, 0, 2.5, 2.5, 0, 1.3, 0, 0.9));
  updaters.push((dt, t) => {
    beacon.update(t); rec.userData.ledUpdate(t);
    const f = 0.93 + 0.05 * Math.sin(t * 1.3) * Math.sin(t * 0.41 + 1) + 0.03 * Math.sin(t * 2.9);
    mat.glow.color.setScalar(f); lamp.intensity = 15 * f; mat.halo.color.setRGB(0.42 * f, 0.23 * f, 0.09 * f);
  });
  const interactables = [
    kit.interactable({ id: 'poi.world.cocytus.poi.memorial', label: 'Read the EURYDICE memorial', pos: fr.pos(0, 1.2, 2.9), radius: 3.8, object: obMesh, lineId: 'world.cocytus.poi.memorial' }),
    kit.interactable({ id: 'log.cocytus.2', label: 'Play field recorder', pos: fr.pos(1.55, 1.2, 2.12), radius: 2.7, object: rec, lineId: 'log.cocytus.2', log: true }),
  ];
  return { group, interactables, colliders, update(dt, t, camPos) { for (const u of updaters) u(dt, t, camPos); } };
}
