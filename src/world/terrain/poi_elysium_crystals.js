// ORPHEUS · Elysium — slot `monolith` (padR 9): the great crystal cluster, centrepiece of the crystal forest.
// 13 giant hexagonal crystals (4–13 m, chamfered edges, pointed bevelled tips) lean out of a glowing fused-glass base, ringed by ~40 satellite crystals and
// shards. Each crystal = an opaque inner CORE (cyan → violet → magenta gradient, "breathes" 1.2–2.4 at ~0.15 Hz) seen through a translucent SHELL (fresnel
// rim, glowing chamfer edges, standard-lit glints). ONE cyan/violet PointLight + a soft ground glow decal + a small beacon on a survey stake.
// Interactable: poi.world.elysium.poi.crystals (at the cluster base).
import * as THREE from 'three';
import { Kb, TAU, lerp, smooth, clamp, baseMats, decalQuad, mergeDecals, decalMat, surface } from './poi_elysium_lib.js';

const PI = Math.PI;
const BREATH_HZ = 0.15;

// ─────────────────────────────── noise / gradient ───────────────────────────────
const h3 = (x, y, z) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); };
function vn3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const a = lerp(lerp(h3(ix, iy, iz), h3(ix + 1, iy, iz), sx), lerp(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), sx), sy);
  const b = lerp(lerp(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), sx), lerp(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), sx), sy);
  return lerp(a, b, sz);
}
const C0 = [0.06, 0.78, 1.0], C1 = [0.38, 0.22, 1.0], C2 = [0.95, 0.20, 0.80];
function grad(h, out) { const a = smooth(0.0, 0.62, h), b = smooth(0.72, 1.0, h); for (let i = 0; i < 3; i++) out[i] = lerp(lerp(C0[i], C1[i], a), C2[i], b); return out; }

// ─────────────────────────────── crystal geometry (flat-shaded, chamfered hexagonal prism with a bevelled point) ───────────────────────────────
class Facets {
  constructor() { this.P = []; this.N = []; this.U = []; this.A = []; this.C = []; this.I = []; this.n = 0; }
  geo(withInfo, withColor) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    if (withInfo) g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.A, 4));
    if (withColor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setIndex(this.I); return g;
  }
}
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _col = [0, 0, 0];
const LIGHT0 = new THREE.Vector3(-0.4, 0.8, 0.45).normalize();

/**
 * c: { x, y, z (base, world), H, R, tilt, az, twist, hue, bevel }   mode 'shell' | 'core'
 * rings (fractions of body Hb / tip Ht): see RINGS. Writes quads (4 verts, flat normal) into the Facets buffer.
 */
const SHELL_RINGS = [[-0.4, 1.12, 'b'], [0, 1.06, 'b'], [0.24, 1.0, 'b'], [0.5, 0.975, 'b'], [1.0, 0.93, 'b'], [0.4, 0.6, 't'], [0.82, 0.17, 't'], [1.0, 0.0, 't']];
const CORE_RINGS = [[0.02, 0.8, 'b'], [0.3, 1.0, 'b'], [0.92, 0.94, 'b'], [0.3, 0.52, 't'], [0.7, 0.14, 't'], [0.84, 0.0, 't']];
function addCrystal(F, c, mode) {
  const shell = mode === 'shell', Ht = Math.min(0.3 * c.H, c.R * 3.4), Hb = c.H - Ht, R = c.R * (shell ? 1 : 0.5), rings = shell ? SHELL_RINGS : CORE_RINGS;
  const tl = clamp(c.tilt, 0, 1.2), d = _d.set(Math.sin(tl) * Math.cos(c.az), Math.cos(tl), Math.sin(tl) * Math.sin(c.az)); _q.setFromUnitVectors(_up, d);
  // 12-gon cross-section: 6 hexagon corners, each chamfered into two points
  const pts = [], t = c.bevel;
  for (let k = 0; k < 6; k++) {
    const a = c.twist + k * PI / 3, ap = c.twist + (k - 1) * PI / 3, an = c.twist + (k + 1) * PI / 3;
    const px = Math.sin(a), pz = Math.cos(a), qx = Math.sin(ap), qz = Math.cos(ap), rx = Math.sin(an), rz = Math.cos(an);
    pts.push([px + (qx - px) * t, pz + (qz - pz) * t], [px + (rx - px) * t, pz + (rz - pz) * t]);
  }
  const ringPos = rings.map(([f, s, kind]) => ({ y: kind === 'b' ? f * Hb : Hb + f * Ht, s: s * R }));
  const tmp = [0, 0, 0], inv = 1 / c.H;
  const put = (x, y, z, nx, ny, nz, u, v, edge) => {
    _v.set(x, y, z).applyQuaternion(_q); _n.set(nx, ny, nz).applyQuaternion(_q);
    F.P.push(_v.x + c.x, _v.y + c.y, _v.z + c.z); F.N.push(_n.x, _n.y, _n.z); F.U.push(u, v);
    const hh = clamp(y * inv, 0, 1);
    if (shell) F.A.push(hh, c.hue, edge, 0); else { grad(clamp(hh + c.hue, 0, 1), tmp); const k = (0.78 + 0.5 * Math.max(0, _n.dot(LIGHT0))) * c.glow; F.C.push(tmp[0] * k, tmp[1] * k, tmp[2] * k); }
  };
  const quad = (a, b, cc, dd, edge, uv0) => {   // a,b bottom (low ring), cc,dd top — vertices as [x,y,z]; outward flat normal
    let nx = (b[1] - a[1]) * (dd[2] - a[2]) - (b[2] - a[2]) * (dd[1] - a[1]), ny = (b[2] - a[2]) * (dd[0] - a[0]) - (b[0] - a[0]) * (dd[2] - a[2]), nz = (b[0] - a[0]) * (dd[1] - a[1]) - (b[1] - a[1]) * (dd[0] - a[0]);
    const mx = (a[0] + b[0] + cc[0] + dd[0]) / 4, mz = (a[2] + b[2] + cc[2] + dd[2]) / 4; let flip = false;
    if (nx * mx + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; flip = true; }
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const base = F.n; put(a[0], a[1], a[2], nx, ny, nz, 0, uv0, edge); put(b[0], b[1], b[2], nx, ny, nz, 1, uv0, edge); put(cc[0], cc[1], cc[2], nx, ny, nz, 1, uv0 + 0.1, edge); put(dd[0], dd[1], dd[2], nx, ny, nz, 0, uv0 + 0.1, edge);
    F.n += 4; if (!flip) F.I.push(base, base + 1, base + 2, base, base + 2, base + 3); else F.I.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };
  for (let r = 0; r < ringPos.length - 1; r++) {
    const lo = ringPos[r], hi = ringPos[r + 1];
    for (let j = 0; j < 12; j++) {
      const p0 = pts[j], p1 = pts[(j + 1) % 12], edge = j % 2 === 0 ? 1 : 0;       // even segments = chamfers
      const a = [p0[0] * lo.s, lo.y, p0[1] * lo.s], b = [p1[0] * lo.s, lo.y, p1[1] * lo.s], cc = [p1[0] * hi.s, hi.y, p1[1] * hi.s], dd = [p0[0] * hi.s, hi.y, p0[1] * hi.s];
      if (hi.s < 1e-4) {   // apex: triangle fan, emitted as a degenerate quad (cc == dd)
        quad(a, b, cc, dd, edge, r * 0.1);
      } else quad(a, b, cc, dd, edge, r * 0.1);
    }
  }
}

// ─────────────────────────────── shader patch (chains with the atmosphere fog patch) ───────────────────────────────
const GLSL_COMMON = /* glsl */ `
varying vec4 vInfo; varying vec3 vObj; uniform float uBreath; uniform vec4 uK;
vec3 elyGrad(float h){ vec3 c0=vec3(0.06,0.78,1.0), c1=vec3(0.38,0.22,1.0), c2=vec3(0.95,0.20,0.80); return mix(mix(c0,c1,smoothstep(0.0,0.62,h)), c2, smoothstep(0.72,1.0,h)); }
float elyH(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float elyN(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(elyH(i),elyH(i+vec3(1,0,0)),f.x), mix(elyH(i+vec3(0,1,0)),elyH(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(elyH(i+vec3(0,0,1)),elyH(i+vec3(1,0,1)),f.x), mix(elyH(i+vec3(0,1,1)),elyH(i+vec3(1,1,1)),f.x), f.y), f.z); }`;
const GLSL_EMIT = /* glsl */ `
{ float eh = clamp(vInfo.x + vInfo.y, 0.0, 1.0); vec3 ec = elyGrad(eh);
  if (uK.w < 0.0) {   // fused base: glowing veins, resolved per pixel
    float v1 = abs(elyN(vObj * 0.8) - 0.5) * 2.0, v2 = abs(elyN(vObj * 2.3 + 7.3) - 0.5) * 2.0;
    float vm = max(1.0 - smoothstep(0.02, 0.085, v1), 0.55 * (1.0 - smoothstep(0.02, 0.07, v2)));
    totalEmissiveRadiance += ec * (uK.z + vm * vInfo.z * uK.y) * uBreath;
  } else {            // crystal shell: fresnel rim + glowing chamfer edges, more opaque where they show
    float efr = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.2);
    totalEmissiveRadiance += ec * (uK.z + efr * uK.x + vInfo.z * uK.y) * uBreath;
    diffuseColor.a = clamp(uK.w + efr * 0.55 + vInfo.z * 0.45, 0.0, 0.95);
  } }`;
function patchCrystal(mat, uBreath, k, id) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(mat, shader, renderer);
    shader.uniforms.uBreath = uBreath; shader.uniforms.uK = { value: new THREE.Vector4(k.rim, k.edge, k.glow, k.alpha) };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aInfo;\nvarying vec4 vInfo;\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvInfo = aInfo; vObj = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_COMMON).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + GLSL_EMIT);
  };
  mat.customProgramCacheKey = () => prevKey + '|elyCrystal' + id;
  return mat;
}

// ─────────────────────────────── builder ───────────────────────────────
export function buildMonolith(env, slot, L) {
  const { kit } = env;
  const rnd = kit.rng('monolith'), kb = new Kb(97).bind(env, L), M = baseMats(kit);
  const group = new THREE.Group(); group.name = 'elysium.monolith';
  const colliders = [], interactables = [], ups = [];
  const gx = slot.x, gz = slot.z, gy = L.gy0;

  // ───── layout: giants (13) in three rings, satellites, shards ─────
  const crystals = [];
  const giant = (x, z, H, R, tilt, az, hue) => crystals.push({ x: gx + x, z: gz + z, y: env.groundY(gx + x, gz + z) - 0.1, H, R, tilt, az, twist: rnd() * PI / 3, hue, bevel: 0.1 + rnd() * 0.05, glow: 0.95, big: true });
  giant(0.0, 0.0, 13.0, 1.55, 0.05, rnd() * TAU, 0.0);                                                             // the spire
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.5 + (rnd() - 0.5) * 0.4, r = 2.2 + rnd() * 0.4; giant(Math.sin(a) * r, Math.cos(a) * r, 8.8 + rnd() * 2.4, 1.05 + rnd() * 0.25, 0.2 + rnd() * 0.1, a + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.3); }
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.2 + (rnd() - 0.5) * 0.5, r = 3.6 + rnd() * 0.5; giant(Math.sin(a) * r, Math.cos(a) * r, 6.0 + rnd() * 2.4, 0.78 + rnd() * 0.22, 0.32 + rnd() * 0.12, a + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4); }
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.9 + (rnd() - 0.5) * 0.5, r = 4.7 + rnd() * 0.5; giant(Math.sin(a) * r, Math.cos(a) * r, 4.2 + rnd() * 2.0, 0.6 + rnd() * 0.18, 0.44 + rnd() * 0.16, a + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5); }
  for (let i = 0; i < 28; i++) {   // satellites
    const a = rnd() * TAU, r = 3.0 + Math.pow(rnd(), 0.7) * 5.2, H = 0.7 + Math.pow(rnd(), 1.6) * 2.6, R = 0.1 + H * 0.085 * (0.7 + rnd() * 0.6);
    crystals.push({ x: gx + Math.sin(a) * r, z: gz + Math.cos(a) * r, y: env.groundY(gx + Math.sin(a) * r, gz + Math.cos(a) * r) - 0.05, H, R, tilt: 0.25 + rnd() * 0.55, az: a + (rnd() - 0.5) * 1.0, twist: rnd() * PI / 3, hue: (rnd() - 0.5) * 0.55, bevel: 0.1 + rnd() * 0.06, glow: 1.2 });
  }
  for (let i = 0; i < 12; i++) {    // glass shards lying around the fringe
    const a = rnd() * TAU, r = 5.0 + rnd() * 4.0, H = 0.25 + rnd() * 0.45, R = 0.045 + rnd() * 0.06;
    crystals.push({ x: gx + Math.sin(a) * r, z: gz + Math.cos(a) * r, y: env.groundY(gx + Math.sin(a) * r, gz + Math.cos(a) * r) - 0.02, H, R, tilt: 0.9 + rnd() * 0.5, az: rnd() * TAU, twist: rnd() * PI / 3, hue: (rnd() - 0.5) * 0.6, bevel: 0.12, glow: 1.1 });
  }
  const shellF = new Facets(), coreF = new Facets();
  for (const c of crystals) { addCrystal(shellF, c, 'shell'); addCrystal(coreF, c, 'core'); }
  const shellGeo = shellF.geo(true, false), coreGeo = coreF.geo(false, true);

  // ───── materials ─────
  const uBreath = { value: 1.8 };
  const mShell = patchCrystal(kit.std({ color: 0x1d2a5a, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.3 }), uBreath, { rim: 0.95, edge: 1.3, glow: 0.05, alpha: 0.34 }, 'S');
  const mCore = kit.glow(0xffffff, 1, { vertexColors: true, toneMapped: true, side: THREE.FrontSide });
  mCore.color.setScalar(0.9);
  const shell = new THREE.Mesh(shellGeo, mShell); shell.name = 'crystal.shell'; shell.renderOrder = 3; shell.castShadow = false; shell.receiveShadow = false;
  const core = new THREE.Mesh(coreGeo, mCore); core.name = 'crystal.core'; core.castShadow = false; core.receiveShadow = false;
  group.add(core, shell);

  // ───── fused glowing base: lumpy dark glass with glowing veins ─────
  const BR = 5.6;
  const moundGeo = surface(56, 16, (u, v, o) => {
    const a = u * TAU, e = v * PI / 2, ce = Math.cos(e), se = Math.sin(e);
    const n1 = vn3(Math.sin(a) * 1.4 + 3, Math.cos(a) * 1.4 + 3, e * 1.2), n2 = vn3(Math.sin(a) * 4 + 9, Math.cos(a) * 4 + 9, e * 3.5);
    const rr = BR * (0.86 + 0.3 * n1) * Math.pow(ce, 0.75) * (1 + 0.05 * (n2 - 0.5));
    o[0] = gx + Math.sin(a) * rr; o[2] = gz + Math.cos(a) * rr; o[1] = env.groundY(o[0], o[2]) - 0.15 + (1.5 + 0.9 * n1) * Math.pow(se, 0.85) * (0.7 + 0.5 * n2);
  }, { wrapU: true, pole1: true });
  { const p = moundGeo.attributes.position, n = p.count, info = new Float32Array(n * 4), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rr = Math.hypot(x - gx, z - gz);
      const fade = smooth(BR * 0.98, BR * 0.25, rr);   // veins fade toward the outer rim; strongest near the crystals
      info[i * 4] = clamp(0.25 + 0.55 * (1 - rr / BR), 0, 1); info[i * 4 + 1] = (vn3(x * 0.3, 7, z * 0.3) - 0.5) * 0.5; info[i * 4 + 2] = 0.35 + 0.65 * fade; info[i * 4 + 3] = 0;
      const dk = 0.8 + 0.4 * vn3(x * 1.3, y, z * 1.3); col[i * 3] = 0.014 * dk; col[i * 3 + 1] = 0.017 * dk; col[i * 3 + 2] = 0.04 * dk;
    }
    moundGeo.setAttribute('aInfo', new THREE.BufferAttribute(info, 4)); moundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const mMound = patchCrystal(kit.std({ color: 0xffffff, roughness: 0.32, metalness: 0.15, vertexColors: true }), uBreath, { rim: 0.3, edge: 2.2, glow: 0.03, alpha: -1 }, 'M');
  const mound = new THREE.Mesh(moundGeo, mMound); mound.name = 'crystal.base'; mound.receiveShadow = true; group.add(mound);

  // ───── ground glow decal + survey stakes + beacon ─────
  const tCrack = kit.canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.translate(w / 2, h / 2);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.28, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
    g.lineCap = 'round'; for (let i = 0; i < 30; i++) { const a = rnd() * TAU, r0 = w * (0.14 + rnd() * 0.14), r1 = w * (0.3 + rnd() * 0.14); g.strokeStyle = `rgba(255,255,255,${0.1 + rnd() * 0.22})`; g.lineWidth = 0.8 + rnd() * 1.4; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); const m = (r0 + r1) / 2, wob = (rnd() - 0.5) * 0.35; g.quadraticCurveTo(Math.cos(a + wob) * m, Math.sin(a + wob) * m, Math.cos(a + wob * 0.4) * r1, Math.sin(a + wob * 0.4) * r1); g.stroke(); }
  }, { wrap: false, aniso: 4 });
  const glowG = [decalQuad(env, gx, gz, 12.5, 12.5, 0, 0.03, [0.10, 0.34, 0.62], 10), decalQuad(env, gx, gz, 8.0, 8.0, 0.6, 0.034, [0.30, 0.14, 0.70], 8)];
  const gMat = decalMat(tCrack); const gMesh = new THREE.Mesh(mergeDecals(glowG), gMat); gMesh.renderOrder = 2; group.add(gMesh);

  // survey stakes with orange tape (Tomas's marks) + the beacon stake
  const stakes = [[-4.6, 5.8], [4.9, 5.2], [7.0, -0.8]];
  for (const [sx, sz] of stakes) { kb.at(sx, sz, rnd() * TAU); kb.rod('metal', [0, 0, 0], [0, 1.1, 0], 0.012, 0.01, 0xb7bec5, 5); kb.box('paint', 0.18, 0.1, 0.004, [0.09, 1.0, 0], [0, 0, 0.1], 0xe5742b); kb.box('paint', 0.18, 0.1, 0.004, [0.09, 0.93, 0], [0, 0.4, -0.1], 0xe9e6dc); }
  const [bsx, bsz] = [2.4, 6.2]; kb.at(bsx, bsz, 0); kb.rod('metal', [0, 0, 0], [0, 1.7, 0], 0.016, 0.012, 0x8b939b, 6);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; kb.rod('metal', [0, 0.5, 0], [Math.sin(a) * 0.35, 0.01, Math.cos(a) * 0.35], 0.008, 0.008, 0xb7bec5, 4); }
  const sm = [kb.mesh('metal', M.metal), kb.mesh('paint', M.paint)]; for (const m of sm) if (m) group.add(m);
  const bp = L.pos(bsx, 1.78, bsz), beacon = kit.beacon([bp.x, bp.y, bp.z], { color: 0xd8ccff, size: 0.075, lightI: 6, range: 20, period: 3.9, duty: 0.4, phase: 0.45 }); group.add(beacon.group);

  // ───── the one cluster light + interactable + colliders ─────
  const light = kit.pointLight(0x8f94ff, 46, 28, [gx, gy + 2.6, gz + 0.6]); group.add(light);
  const bp0 = L.pos(0, 1.3, 4.9);
  interactables.push(kit.interactable({ id: 'poi.world.elysium.poi.crystals', label: 'Examine the crystal cluster', pos: bp0, radius: 3.4, object: shell, lineId: 'world.elysium.poi.crystals' }));
  colliders.push(kit.cyl(gx, gz, 4.0, gy - 0.5, gy + 2.2));
  for (const c of crystals) if (c.big) colliders.push(kit.cyl(c.x, c.z, c.R * 1.05, c.y, c.y + c.H * Math.cos(c.tilt)));
  for (const c of crystals) if (!c.big && c.R > 0.3) colliders.push(kit.cyl(c.x, c.z, c.R * 1.1, c.y, c.y + c.H * 0.9));

  // ───── animation: slow breathing 1.2–2.4 @ 0.15 Hz, light + decal pulse in step ─────
  const l0 = light.intensity;
  const update = (dt, t) => {
    const b = 1.8 + 0.6 * Math.sin(TAU * BREATH_HZ * t), k = (b - 1.2) / 1.2;
    uBreath.value = b; mCore.color.setScalar(b / 1.8 * 0.9); light.intensity = l0 * (0.82 + 0.36 * k); gMat.color.setScalar(0.72 + 0.5 * k);
    beacon.update(t);
  };
  update(0, 0);
  return { group, interactables, colliders, update };
}
