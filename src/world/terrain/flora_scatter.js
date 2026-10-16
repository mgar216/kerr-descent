// ORPHEUS · surface · flora_scatter — GPU-driven toroidal scatter (phlegethon · charon · cocytus · elysium).
//   createScatterFlora(o) → { group, bakeAll(cam), update(camPos, t, dt), compile(), collide(p, radius, height), colliders, dispose() }
// Same structure as flora.js grass: every window (near fine / mid / far big) owns a small RGBA32F placement texture (2W × W: texel A = world x,
// ship-space y incl. curvature, world z, size · texel B = colour/params, 24-bit seed) re-baked by a tiny fullscreen pass whenever the camera crosses a
// cell. The instance vertex shaders only do two texelFetches and carve every rock / column / crystal cluster from hashed noise, so no two are alike.
// Heights come ONLY from the baked terrain textures (sfBakedH). Crystal clusters, boulders and basalt column clusters are mirrored in JS (same hashes and
// density maths) so collide() blocks exactly what the GPU draws; the ferryman's ice spires are CPU-placed (InstancedMesh + colliders).
import * as THREE from 'three';
import { mulberry, rand01, hashU, ss } from './noise.js';
import { PLACE_VERT, bakeFrag, instanceVS, FS_COMMON_DECL, FS_ROCK, FS_GEM } from './flora_scatter_gl.js';
import { icoSphereGeo, columnClusterGeo, crystalClusterGeo, spireGeo } from './flora_scatter_geo.js';

const TAU = Math.PI * 2;

// ───────────────────────────── layer tables ─────────────────────────────
// kind: rock (convex polytope) · column (hex basalt cluster) · gem (hex-prism crystal cluster)
// rock: [bump, snow, rim glow, vesicle] + rough, sss, refl · gem: emissive K, sss K, refl K, albedo K
const D = (o) => Object.assign({ inner: [-1, 0], pow: 1, padKeep: 0, xp: [0, 0, 0, 0], rule: 0, lseed: 0, cast: false, collide: false, shape2: [0, 0, 0, 0], shape3: [0, 1, 1, 0] }, o);
const ROCK = (o) => Object.assign({ kind: 'rock' }, o);

const BASALT = { bump: 0.55, snow: 0, rim: 0.30, ves: 0.35, rough: 0.9, sss: 0, refl: 0, fall: 26 };
const REGO = { bump: 0.65, snow: 0, rim: 0, ves: 0.0, rough: 0.95, sss: 0, refl: 0, fall: 1 };
const ICEB = { bump: 0.22, snow: 0, rim: 0, ves: 0, rough: 0.32, sss: 1.0, refl: 0.7, fall: 1 };
const SNOWR = { bump: 0.55, snow: 1, rim: 0, ves: 0.0, rough: 0.86, sss: 0, refl: 0, fall: 1 };

const LAYERS = {
  phlegethon: () => [
    D(ROCK({ name: 'basalt-near', geo: ['ico', 2], W: 40, cell: 0.9, rule: 0, density: 1.3, size: [0.15, 2.0], pow: 2.2, lseed: 101, xp: [1.0, 0, 0, 0], shape: [1.15, 0.30, 0.30, 0.22], rock: BASALT, river: true, cast: true, collide: true })),
    D(ROCK({ name: 'basalt-mid', geo: ['ico', 1], W: 40, cell: 3.4, rule: 0, density: 0.8, size: [1.4, 6.0], pow: 1.8, lseed: 102, xp: [0.4, 0, 0, 0], shape: [1.10, 0.28, 0.30, 0.40], rock: BASALT, river: true, cast: true, collide: true })),
    D(ROCK({ name: 'basalt-far', geo: ['ico', 1], W: 36, cell: 16, rule: 0, density: 0.7, size: [6.0, 16], pow: 1.5, lseed: 103, xp: [0, 0, 0, 0], shape: [1.05, 0.24, 0.30, 0.38], rock: BASALT, river: true, collide: true })),
    D(ROCK({ name: 'cinders', geo: ['ico', 1], W: 36, cell: 0.5, rule: 1, density: 1.4, size: [0.04, 0.20], pow: 1.5, lseed: 104, padKeep: 0.35, shape: [0.80, 0.5, 0.35, 0.45], rock: { ...BASALT, bump: 0.2, rim: 0.10 }, river: true })),
    D({ name: 'columns', kind: 'column', geo: ['col'], W: 24, cell: 10.5, rule: 2, density: 1.35, size: [1.6, 7.0], pow: 1.5, lseed: 105, xp: [1.0, 0, 0, 0], shape: [0.30, 0, 0, 0], rock: { ...BASALT, rim: 0.22 }, river: true, cast: true, collide: true }),
  ],
  charon: () => [
    D(ROCK({ name: 'regolith-near', geo: ['ico', 2], W: 40, cell: 0.8, rule: 0, density: 1.8, size: [0.12, 1.8], pow: 3.0, lseed: 201, shape: [1.0, 0.32, 0.30, 0.22], rock: REGO, cast: true, collide: true })),
    D(ROCK({ name: 'regolith-mid', geo: ['ico', 1], W: 40, cell: 3.2, rule: 0, density: 0.9, size: [1.2, 5.0], pow: 2.6, lseed: 202, shape: [0.95, 0.28, 0.30, 0.40], rock: REGO, cast: true, collide: true })),
    D(ROCK({ name: 'regolith-far', geo: ['ico', 1], W: 36, cell: 15, rule: 0, density: 0.7, size: [4.0, 12.0], pow: 2.2, lseed: 203, shape: [0.90, 0.25, 0.30, 0.38], rock: REGO, collide: true })),
    D(ROCK({ name: 'ice-near', geo: ['ico', 1], W: 36, cell: 2.0, rule: 1, density: 0.40, size: [0.25, 2.2], pow: 2.5, lseed: 204, shape: [1.05, 0.30, 0.28, 0.32], rock: ICEB, cast: true, collide: true })),
    D(ROCK({ name: 'ice-mid', geo: ['ico', 1], W: 32, cell: 8, rule: 1, density: 0.35, size: [1.6, 5.5], pow: 2.0, lseed: 205, shape: [1.05, 0.26, 0.28, 0.30], rock: ICEB, collide: true })),
  ],
  cocytus: () => [
    D({ name: 'shards-near', kind: 'gem', geo: ['cry', 3], W: 40, cell: 1.3, rule: 0, density: 0.20, size: [0.25, 1.9], pow: 1.7, lseed: 301, padKeep: 0.2, xp: [0.10, 0.25, 0, 0], shape: [1, 3, 0.45, 0.75], shape2: [0.13, 0.10, 0.52, 0.5], shape3: [0.30, 2.5, 0.55, 0], gem: { emis: 0, sss: 1.0, refl: 0.9, albedo: 0.55, rough: 0.16, ice: true }, cast: true }),
    D({ name: 'shards-mid', kind: 'gem', geo: ['cry', 3], W: 36, cell: 6, rule: 0, density: 0.18, size: [1.2, 2.6], pow: 1.5, lseed: 302, xp: [0, 0, 0, 0], shape: [1, 3, 0.45, 0.70], shape2: [0.13, 0.10, 0.52, 0.5], shape3: [0.25, 2.2, 0.60, 0], gem: { emis: 0, sss: 1.0, refl: 0.9, albedo: 0.55, rough: 0.16, ice: true }, cast: true }),
    D(ROCK({ name: 'snowrock-near', geo: ['ico', 2], W: 32, cell: 1.8, rule: 1, density: 0.9, size: [0.2, 2.0], pow: 2.2, lseed: 303, shape: [1.05, 0.30, 0.30, 0.22], rock: SNOWR, cast: true, collide: true })),
    D(ROCK({ name: 'snowrock-mid', geo: ['ico', 1], W: 36, cell: 7, rule: 1, density: 0.7, size: [1.6, 5.5], pow: 1.8, lseed: 304, shape: [1.00, 0.26, 0.30, 0.35], rock: SNOWR, cast: true, collide: true })),
  ],
  elysium: () => {
    const gem = { emis: 1, sss: 0, refl: 0.55, albedo: 0.09, rough: 0.12, ice: false };
    const sh = [3, 6, 0.33, 0.55], sh2 = [0.085, 0.070, 0.66, 0.8];
    return [
      D({ name: 'crystals-near', kind: 'gem', geo: ['cry', 6], W: 38, cell: 1.8, rule: 0, density: 1.05, size: [0.4, 3.0], pow: 1.8, lseed: 401, padKeep: 0, shape: sh, shape2: sh2, gem, cast: true, collide: true }),
      D({ name: 'crystals-mid', kind: 'gem', geo: ['cry', 6], W: 36, cell: 7.5, rule: 0, density: 0.85, size: [2.0, 8.0], pow: 1.6, lseed: 402, shape: sh, shape2: sh2, gem, cast: true, collide: true }),
      D({ name: 'crystals-far', kind: 'gem', geo: ['cry', 6], W: 28, cell: 36, rule: 0, density: 0.72, size: [8.0, 30.0], pow: 1.5, lseed: 403, shape: sh, shape2: sh2, gem, collide: true }),
    ];
  },
};

// ───────────────────────────── JS twin of the crystal placement (collisions) ─────────────────────────────
function vn2(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = rand01(ix, iy, seed), b = rand01(ix + 1, iy, seed), c = rand01(ix, iy + 1, seed), d = rand01(ix + 1, iy + 1, seed);
  const ab = a + (b - a) * ux, cd = c + (d - c) * ux;
  return ab + (cd - ab) * uy;
}

/** exactly the bake rule of RULES.elysium + the GEM_PLACE hashing; returns true when the cell holds a cluster and fills `out`. */
function crystalCell(L, tw, ix, iz, out) {
  const sd = tw.sd + L.lseed;
  const r0 = rand01(ix, iz, sd + 1), r1 = rand01(ix, iz, sd + 2), r2 = rand01(ix, iz, sd + 3), r3 = rand01(ix, iz, sd + 4);
  const gx = (ix + r0) * L.cell, gz = (iz + r1) * L.cell;
  const clear = ss(0.26, 0.60, vn2(gx * 0.021, gz * 0.021, tw.sd + 111));
  let pk = ss(tw.pads[0].r0 * 0.96, tw.pads[0].r0 * 1.30, Math.hypot(gx - tw.pads[0].x, gz - tw.pads[0].z));
  for (let i = 1; i < tw.pads.length; i++) { const p = tw.pads[i]; pk *= L.padKeep + (1 - L.padKeep) * ss(p.r0 * 0.85, p.r0 * 1.25 + 1, Math.hypot(gx - p.x, gz - p.z)); }
  const dens = L.density * tw.cd * (0.12 + 0.88 * clear) * pk;
  if (r2 > dens) return false;
  out.gx = gx; out.gz = gz; out.size = L.size[0] + (L.size[1] - L.size[0]) * Math.pow(r3, L.pow); out.seed = hashU(ix, iz, sd + 7) >>> 8;
  return true;
}

/** per-crystal parameters of a cluster (twin of GEM_PLACE) into `c` (x, z base position; len, rad, tilt, tdir). Allocation-free. */
function crystalParams(L, seed, size, gx, gz, i, cnt, c) {
  const sh = L.shape, sh2 = L.shape2, main = i === 0;
  const aj = rand01(seed, 10 + i, 21);
  const ang = TAU * (rand01(seed, 2, 21) + (i - 1 + 0.7 * aj) / Math.max(cnt - 1, 1));
  const dst = main ? 0 : (0.30 + 0.55 * rand01(seed, 20 + i, 21)) * size * sh[2];
  c.len = size * (main ? 1 : 0.36 + 0.52 * rand01(seed, 30 + i, 21));
  c.rad = Math.max(c.len * (sh2[0] + sh2[1] * rand01(seed, 40 + i, 21)), 0.02);
  c.tilt = (main ? 0.25 : 1) * sh[3] * (0.35 + 0.65 * rand01(seed, 50 + i, 21));
  c.tdir = ang + (rand01(seed, 60 + i, 21) - 0.5) * 0.8;
  c.x = gx + Math.cos(ang) * dst; c.z = gz + Math.sin(ang) * dst;
}

function makeCrystalCollider(L, hf, tw) {
  const cl = {}, cr = {};
  const ext = L.size[1] * (0.85 * L.shape[2] + 0.2) + 1.0;
  return function collide(p, radius, height) {
    const R = radius + ext, ix0 = Math.floor((p.x - R) / L.cell), ix1 = Math.floor((p.x + R) / L.cell), iz0 = Math.floor((p.z - R) / L.cell), iz1 = Math.floor((p.z + R) / L.cell);
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      if (!crystalCell(L, tw, ix, iz, cl)) continue;
      const rej = radius + cl.size * (0.85 * L.shape[2] + 0.16) + 0.8, qx = p.x - cl.gx, qz = p.z - cl.gz;
      if (qx * qx + qz * qz > rej * rej) continue;   // not near this cluster
      const cnt = Math.min(L.shape[0] + Math.floor(rand01(cl.seed, 1, 21) * (L.shape[1] - L.shape[0] + 1)), L.shape[1]);
      for (let i = 0; i < cnt; i++) {
        crystalParams(L, cl.seed, cl.size, cl.gx, cl.gz, i, cnt, cr);
        const top = cr.len * Math.cos(cr.tilt);
        if (top < 0.45) continue;                     // low enough to step over
        const hr = Math.min(top, 1.0);                // lean offset sampled at ~1 m (torso height)
        const ct = Math.cos(cr.tilt), sh = Math.sin(cr.tilt) / (ct * ct) * hr;
        const cx = cr.x + Math.cos(cr.tdir) * sh, cz = cr.z + Math.sin(cr.tdir) * sh, rr = radius + cr.rad * 0.9;
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const g = hf.groundY(cr.x, cr.z);
        if (!(p.y + height > g - 0.45 && p.y < g + top - 0.05)) continue;
        const d = Math.sqrt(d2) || 1e-4, k = rr / d;
        p.x = cx + dx * k; p.z = cz + dz * k;
      }
    }
  };
}

// ───────────────────────────── JS twin of the rock / column placement (collisions) ─────────────────────────────
function padFactor(tw, x, z, keepIn) {
  const p0 = tw.pads[0];
  let pk = ss(p0.r0 * 0.96, p0.r0 * 1.30, Math.hypot(x - p0.x, z - p0.z));
  for (let i = 1; i < tw.pads.length; i++) { const p = tw.pads[i]; pk *= keepIn + (1 - keepIn) * ss(p.r0 * 0.85, p.r0 * 1.25 + 1, Math.hypot(x - p.x, z - p.z)); }
  return pk;
}

/** density terms of the bake rules that do NOT need the terrain slope: dens = base·(a + b·smoothstep(e0, e1, slope)) (twin of RULES[biome]) */
function rockBase(biome, L, tw, x, z, r5, out) {
  const sd = tw.sd, d = L.density, pk = padFactor(tw, x, z, L.padKeep), hf = tw.hf, P = hf.P;
  if (biome === 'phlegethon') {
    const rv = tw.river, rd = Math.abs(rv.dist(x, z)), wc = rv.wLava * rv.chan;
    const lavaOK = ss(wc + 3, wc + 7.5, rd), rubble = Math.exp(-Math.pow((rd - wc * 1.12) / 12, 2));
    if (L.kind === 'column') {
      const outc = ss(0.50, 0.85, vn2(x * 0.011 + 3, z * 0.011 + 3, sd + 331));
      out.base = d * (0.15 + 0.85 * outc) * lavaOK * pk; out.a = 0.35 + 1.2 * rubble * L.xp[0]; out.b = 2.2; out.e0 = 0.04; out.e1 = 0.30;
    } else {
      const clump = ss(0.28, 0.78, vn2(x * 0.026 + 11, z * 0.026 + 11, sd + 301));
      out.base = d * (0.30 + 0.70 * clump) * (1 + 1.6 * rubble * L.xp[0]) * lavaOK * pk; out.a = 0.6; out.b = 2.0; out.e0 = 0.02; out.e1 = 0.28;
    }
  } else if (biome === 'charon') {
    const clump = ss(0.22, 0.80, vn2(x * 0.03 + 5, z * 0.03 + 5, sd + 301));
    if (L.rule === 0) {
      let rimB = 1; if (P[6] > 1) { const q = Math.hypot(x - P[4], z - P[5]) / P[6], rl = (q - 1) / 0.10; rimB += 2.2 * Math.exp(-rl * rl); }
      out.base = d * (0.35 + 0.65 * clump) * rimB * pk; out.a = 0.6; out.b = 2.2; out.e0 = 0.04; out.e1 = 0.30;
    } else {
      const iceF = ss(0.30, 0.75, vn2(x * 0.008, z * 0.008, sd + 3) * 0.55 + vn2(x * 0.05, z * 0.05, sd + 5) * 0.5 + (r5 - 0.5) * 0.25);
      out.base = d * (0.15 + 0.85 * iceF) * (0.7 + 0.6 * clump) * pk; out.a = 1.0; out.b = 1.1; out.e0 = 0.04; out.e1 = 0.30;
    }
  } else {   // cocytus snow rocks
    const onLake = ss(-6, 4, P[6] > 1 ? P[6] - Math.hypot(x - P[4], z - P[5]) : -1e4);
    let vent = 1; for (let i = 0; i < hf.vn; i++) vent *= ss(hf.V[i * 4 + 2] * 0.26, hf.V[i * 4 + 2] * 0.72, Math.hypot(x - hf.V[i * 4], z - hf.V[i * 4 + 1]));
    const clump = ss(0.25, 0.80, vn2(x * 0.028 + 7, z * 0.028 + 7, sd + 301));
    out.base = d * (0.25 + 0.75 * clump) * (1 - onLake) * vent * pk; out.a = 0.6; out.b = 2.0; out.e0 = 0.03; out.e1 = 0.30;
  }
}

/** boulders / column clusters that are tall enough to block the walker (≥ 0.5 m). Existence is decided exactly like the bake (the slope term, which needs
 *  terrain height taps, is only evaluated for borderline cells), so a rock you see is a rock you bump into. */
function makeBlockCollider(L, hf, tw, biome) {
  const out = {}, sh = L.shape, isCol = L.kind === 'column', sd = tw.sd + L.lseed;
  const ext = isCol ? 3.0 * Math.min(0.85, sh[0] + 0.045 * L.size[1]) + 0.6 : 0.5 * L.size[1] * 0.95 + 0.4;
  return function collide(p, radius, height) {
    const R = radius + ext, ix0 = Math.floor((p.x - R) / L.cell), ix1 = Math.floor((p.x + R) / L.cell), iz0 = Math.floor((p.z - R) / L.cell), iz1 = Math.floor((p.z + R) / L.cell);
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const gx = (ix + rand01(ix, iz, sd + 1)) * L.cell, gz = (iz + rand01(ix, iz, sd + 2)) * L.cell, dx = p.x - gx, dz = p.z - gz, d2 = dx * dx + dz * dz;
      if (d2 > R * R) continue;
      const size = L.size[0] + (L.size[1] - L.size[0]) * Math.pow(rand01(ix, iz, sd + 4), L.pow);
      let rr, top;
      if (isCol) { rr = 3.0 * Math.min(0.85, Math.max(0.26, sh[0] + 0.045 * size)); top = size * 0.55; }
      else {
        const seed = hashU(ix, iz, sd + 7) >>> 8, hx = 0.60 + 0.40 * rand01(seed, 1, 11), hy = (0.60 + 0.40 * rand01(seed, 2, 11)) * sh[0], hz = 0.60 + 0.40 * rand01(seed, 3, 11), el = 0.70 + 0.75 * rand01(seed, 7, 11);
        rr = 0.5 * size * 0.82 * Math.sqrt(hx * hz * el / Math.sqrt(el)); top = 0.5 * size * hy * (0.88 - sh[2]);
      }
      if (top < 0.5) continue;                           // low enough to step over
      const q = rr + radius; if (d2 >= q * q) continue;
      const r2 = rand01(ix, iz, sd + 3);
      rockBase(biome, L, tw, gx, gz, rand01(ix, iz, sd + 6), out);
      if (r2 > out.base * (out.a + out.b)) continue;     // cannot exist even on the steepest ground
      if (r2 > out.base * out.a) {                       // borderline: depends on the terrain slope the bake measured
        const eps = Math.min(4, Math.max(0.45, size * 0.45)), h0 = hf.height(gx, gz), ha = hf.height(gx + eps, gz), hb = hf.height(gx, gz + eps);
        if (r2 > out.base * (out.a + out.b * ss(out.e0, out.e1, 1 - eps / Math.hypot(h0 - ha, eps, h0 - hb)))) continue;
      }
      const g = hf.groundY(gx, gz);
      if (!(p.y + height > g - 0.45 && p.y < g + top - 0.05)) continue;
      const d = Math.sqrt(d2) || 1e-4, k = q / d;
      p.x = gx + dx * k; p.z = gz + dz * k;
    }
  };
}

// ───────────────────────────── ferryman ice spires (CPU placed) ─────────────────────────────
function buildSpires(o, atmo, ts, group, colliders, disposables) {
  const sp = o.site.spires; if (!sp) return null;
  const hf = o.hf, rnd = mulberry(((hf.seed >>> 0) * 2654435761 + 911) | 0);
  const N = sp.count | 0;
  const geo = spireGeo(9);
  const gemM = { value: new THREE.Vector4(0, 1.0, 0.8, 0.62) };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0, flatShading: true, emissive: new THREE.Color(0.030, 0.075, 0.150) });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGemM = gemM; shader.uniforms.uTime = ts.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSfCol; varying vec4 vSfInfo; varying vec3 vSfP; varying vec2 vSfRing;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSfCol = mix(vec3(0.30, 0.52, 0.84), vec3(0.80, 0.92, 1.0), smoothstep(0.0, 0.85, position.y)); vSfInfo = vec4(clamp(position.y, 0.0, 1.0), 0.0, 0.0, -1.0); vSfRing = vec2(0.0); vSfP = (instanceMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FS_COMMON_DECL + FS_GEM.decl)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FS_GEM.color)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FS_GEM.emissive);
  };
  mat.customProgramCacheKey = () => 'sfScSpire';
  atmo.patchMaterial(mat);
  const im = new THREE.InstancedMesh(geo, mat, N);
  im.name = 'ice-spires'; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.renderOrder = 12;
  const dummy = new THREE.Object3D(), placed = [];
  const pc = o.padCenter, padR = o.padR0 + 20, pads = Object.values(o.site.slots || {});
  let n = 0;
  for (let tries = 0; tries < N * 60 && n < N; tries++) {
    const a = rnd() * TAU, r = sp.r * Math.pow(rnd(), 0.8);
    const x = sp.cx + Math.cos(a) * r, z = sp.cz + Math.sin(a) * r;
    if (Math.hypot(x - pc[0], z - pc[1]) < padR) continue;
    let bad = false;
    for (const s of pads) if (s.padR > 0 && Math.hypot(x - s.x, z - s.z) < s.padR + 14) { bad = true; break; }
    if (bad) continue;
    const t = Math.pow(rnd(), 1.8), h = 8 + 40 * t;
    const rb = Math.min(4.0, Math.max(1.2, (1.2 + 2.6 * t) * (0.8 + 0.4 * rnd())));
    for (const q of placed) if (Math.hypot(x - q.x, z - q.z) < (rb + q.r) * 0.95 + 1.0) { bad = true; break; }
    if (bad) continue;
    const y = hf.groundY(x, z);
    placed.push({ x, z, r: rb });
    dummy.position.set(x, y - 0.35, z);
    const lean = (rnd() - 0.2) * 0.14, ld = rnd() * TAU;
    dummy.rotation.set(Math.sin(ld) * lean, rnd() * TAU, Math.cos(ld) * lean, 'YXZ');
    dummy.scale.set(rb, h, rb * (0.62 + 0.38 * rnd()));
    dummy.updateMatrix(); im.setMatrixAt(n, dummy.matrix);
    colliders.push({ x, z, r: rb * 0.8, y0: y - 1, y1: y + h });
    n++;
  }
  im.count = n; im.instanceMatrix.needsUpdate = true;
  group.add(im);
  disposables.push(() => { geo.dispose(); mat.dispose(); im.dispose(); });
  return { mesh: im, count: n };
}

// ───────────────────────────── factory ─────────────────────────────
export function createScatterFlora(o) {
  const { ctx, atmo, biome, hf } = o, ts = o.terrainShared, renderer = ctx.renderer;
  if (!LAYERS[biome]) return null;
  const group = new THREE.Group(); group.name = 'flora-scatter';
  const colliders = [], disposables = [];
  const defs = LAYERS[biome]();

  const bakeGeo = new THREE.BufferGeometry(); bakeGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bakeFS = bakeFrag(biome);
  const baseGeos = new Map();
  const baseGeo = (g) => {
    const k = g.join('|'); let b = baseGeos.get(k);
    if (!b) { b = g[0] === 'ico' ? icoSphereGeo(g[1]) : g[0] === 'col' ? columnClusterGeo() : crystalClusterGeo(g[1]); baseGeos.set(k, b); }
    return b;
  };

  const wins = [], depthMats = [];
  for (const L of defs) {
    const rt = new THREE.WebGLRenderTarget(L.W * 2, L.W, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
    const bu = {
      uCamCell: { value: new THREE.Vector2(1e9, 1e9) }, uW: { value: L.W }, uCellS: { value: L.cell }, uHalfR: { value: L.W * L.cell / 2 }, uInner: { value: new THREE.Vector2(L.inner[0], L.inner[1]) },
      uDensity: { value: L.density }, uSize: { value: new THREE.Vector2(L.size[0], L.size[1]) }, uSizePow: { value: L.pow }, uRule: { value: L.rule }, uPadKeep: { value: L.padKeep },
      uXP: { value: new THREE.Vector4(...L.xp) }, uLSeed: { value: L.lseed },
      uSeed: ts.uSeed, uK: ts.uK, uGroundY: ts.uGroundY, uCurvC: ts.uCurvC, uPadA: ts.uPadA, uPadN: ts.uPadN, uP: ts.uP, uV: ts.uV, uVN: ts.uVN, uHT: ts.uHT, uHC: ts.uHC,
    };
    const bakeMat = new THREE.ShaderMaterial({ vertexShader: PLACE_VERT, fragmentShader: bakeFS, uniforms: bu, depthTest: false, depthWrite: false });
    const bakeMesh = new THREE.Mesh(bakeGeo, bakeMat); bakeMesh.frustumCulled = false;
    const bakeScene = new THREE.Scene(); bakeScene.add(bakeMesh);

    // instanced geometry sharing the cached base attributes
    const bg = baseGeo(L.geo), ig = new THREE.InstancedBufferGeometry();
    ig.index = bg.index; for (const k of Object.keys(bg.attributes)) ig.attributes[k] = bg.attributes[k];
    const slots = new Float32Array(L.W * L.W * 2); for (let i = 0; i < L.W * L.W; i++) { slots[i * 2] = i % L.W; slots[i * 2 + 1] = Math.floor(i / L.W); }
    ig.setAttribute('aSlot', new THREE.InstancedBufferAttribute(slots, 2)); ig.instanceCount = L.W * L.W;

    // materials (one program per kind, uniforms per layer)
    const sh = L.shape, sh2 = L.shape2;
    const mu = { uPlace: { value: rt.texture }, uTime: ts.uTime, uShape: { value: new THREE.Vector4(...sh) }, uShape2: { value: new THREE.Vector4(...sh2) }, uShape3: { value: new THREE.Vector4(...L.shape3) } };
    const river = !!L.river && !!o.features?.river, ice = !!L.gem?.ice;
    if (river) mu.uP = ts.uP;
    let fs, rough;
    if (L.kind === 'gem') {
      mu.uGemM = { value: new THREE.Vector4(L.gem.emis, L.gem.sss, L.gem.refl, L.gem.albedo) }; fs = FS_GEM; rough = L.gem.rough;
    } else {
      const R = L.rock, rv = river ? o.features.river : null;
      mu.uRockM = { value: new THREE.Vector4(R.bump, R.snow, river ? R.rim : 0, R.ves) };
      mu.uRockN = { value: new THREE.Vector4(rv ? rv.wLava : 0, R.fall, R.sss, R.refl) };
      fs = FS_ROCK; rough = R.rough;
    }
    const vs = instanceVS(L.kind, { river, ice }, false), vsD = instanceVS(L.kind, { river, ice }, true);
    const key = 'sfSc-' + L.kind + (river ? 'R' : '') + (ice ? 'I' : '');
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: 0, flatShading: true });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, mu);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + vs.decl)
        .replace('#include <beginnormal_vertex>', vs.normal)
        .replace('#include <begin_vertex>', vs.begin);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FS_COMMON_DECL + fs.decl)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + fs.color)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (fs.normal || ''))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + fs.emissive);
    };
    mat.customProgramCacheKey = () => key;
    atmo.patchMaterial(mat);
    const mesh = new THREE.Mesh(ig, mat);
    mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = !!L.cast; mesh.name = 'scatter-' + L.name; mesh.renderOrder = 12;
    let depthMat = null;
    if (L.cast) {
      depthMat = new THREE.MeshDepthMaterial();
      depthMat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, mu);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + vsD.decl).replace('#include <begin_vertex>', vsD.begin);
      };
      depthMat.customProgramCacheKey = () => key + '-depth';
      mesh.customDepthMaterial = depthMat; depthMats.push(depthMat);
    }
    group.add(mesh);
    wins.push({ L, rt, bu, bakeMat, bakeScene, mesh, ig, mat, cx: NaN, cz: NaN, dirty: 0 });
  }

  function bake(w, cx, cz) {
    w.bu.uCamCell.value.set(cx, cz);
    const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear; renderer.autoClear = false;
    renderer.setRenderTarget(w.rt); renderer.render(w.bakeScene, bakeCam);
    renderer.setRenderTarget(prevRT); renderer.autoClear = prevAuto;
    w.cx = cx; w.cz = cz;
  }

  buildSpires(o, atmo, ts, group, colliders, disposables);

  // JS twins of the placement (crystal clusters in elysium, boulders + basalt column clusters elsewhere) for every layer flagged `collide`
  const twin = { sd: hf.seed >>> 0, cd: hf.P[2], pads: hf.pads, hf, river: o.features?.river };
  const colls = wins.filter((w) => w.L.collide).map((w) => (biome === 'elysium' ? makeCrystalCollider(w.L, hf, twin) : makeBlockCollider(w.L, hf, twin, biome)));

  return {
    group, colliders,
    bakeAll(cam) { for (const w of wins) bake(w, Math.floor(cam.x / w.L.cell), Math.floor(cam.z / w.L.cell)); },
    update(cam, t, dt) {
      for (const w of wins) {
        const cx = Math.floor(cam.x / w.L.cell), cz = Math.floor(cam.z / w.L.cell);
        w.dirty += dt;
        if (cx !== w.cx || cz !== w.cz || w.dirty > 1.0) { bake(w, cx, cz); w.dirty = 0; }
      }
    },
    compile() { return Promise.all(wins.map((w) => (renderer.compileAsync ? renderer.compileAsync(w.bakeScene, bakeCam) : Promise.resolve()))); },
    collide(p, radius, height) { for (let i = 0; i < colls.length; i++) colls[i](p, radius, height); },
    dispose() {
      for (const w of wins) { w.rt.dispose(); w.bakeMat.dispose(); w.ig.dispose(); w.mat.dispose(); }
      for (const m of depthMats) m.dispose();
      for (const g of baseGeos.values()) g.dispose();
      bakeGeo.dispose();
      for (const f of disposables) f();
    },
  };
}
