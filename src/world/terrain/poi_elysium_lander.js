// ORPHEUS · Elysium — slot `lantern` (padR 12): the crew lander LANTERN (≈7 m across the foot pads, ≈6.5 m to the antenna tip).
// Gold-foil hex descent stage on four legs, round-windowed crew pod with name decals + livery stripes, open hatch with a warm lantern light and a short
// ladder, hanging work-lamp, antennas + dish, frost/dust, a vitrified exhaust ring on the ground and TOMAS's recorder at a footpad (log.elysium.2).
import * as THREE from 'three';
import { Kb, TAU, lerp, smooth, clamp, baseMats, glowTexture, decalQuad, mergeDecals, decalMat, consolidate, recorderStyle, printsGeo, stencilText, SANS, HAND } from './poi_elysium_lib.js';
import { printTexture } from './poi_elysium_camp_tex.js';

const PI = Math.PI;
const HOT = (k = 1) => [4.6 * k, 2.35 * k, 0.85 * k];
const K = { hull: 0xd3d6d6, carbon: 0x24272c, dark: 0x2e3238, steel: 0x7f878f, alu: 0xb7bec5, orange: 0xe5742b, cyan: 0x2cb7cb, rubber: 0x16181b, gold: 0xc7a24e, deck: 0x3b4148 };
/** same geometry seen from the other side (indices swapped, normals negated) — for hollow shells viewed from inside */
const flipped = (g) => { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); return g; };

// ─────────────────────────────── textures ───────────────────────────────
function foilTexture(kit) {
  const rnd = kit.rng('lander.foil');
  return kit.canvasTexture(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#caa24c'); gr.addColorStop(0.5, '#e6c76c'); gr.addColorStop(1, '#bb9238'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {                       // crinkled facets
      const x = rnd() * w, y = rnd() * h, s = 6 + rnd() * 20, a = rnd() * TAU, t = rnd();
      g.fillStyle = t < 0.5 ? `rgba(255,236,170,${0.10 + rnd() * 0.22})` : `rgba(70,44,10,${0.10 + rnd() * 0.22})`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); g.lineTo(x + Math.cos(a + 2.1) * s * 0.8, y + Math.sin(a + 2.1) * s * 0.8); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(255,240,190,0.22)'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 46; i++) { const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 60); }
    g.stroke();
    g.fillStyle = 'rgba(30,22,12,0.85)'; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7); g.fillRect(0, 0, 7, h); g.fillRect(w - 7, 0, 7, h);   // black kapton tape edges
    g.fillStyle = 'rgba(30,22,12,0.7)'; g.fillRect(0, h / 2 - 3, w, 6);
  }, { aniso: 8 });
}

function hullTexture(kit) {
  const tex = kit.panelTexture({ base: '#d2d5d6', cols: 12, rows: 3, w: 512, h: 256, seed: 9, grimeAmt: 0.45, repeat: [1, 1] });
  const g = tex.image.getContext('2d'), w = 512, h = 256, rnd = kit.rng('lander.hull');
  const dust = g.createLinearGradient(0, h, 0, h * 0.35); dust.addColorStop(0, 'rgba(50,58,86,0.55)'); dust.addColorStop(1, 'rgba(50,58,86,0)'); g.fillStyle = dust; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { const x = rnd() * w, y0 = h * (0.1 + rnd() * 0.5), len = 30 + rnd() * 90, gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, 'rgba(40,36,34,0)'); gr.addColorStop(0.3, 'rgba(40,36,34,0.22)'); gr.addColorStop(1, 'rgba(40,36,34,0)'); g.fillStyle = gr; g.fillRect(x, y0, 2 + rnd() * 3, len); }
  tex.needsUpdate = true;
  return tex;
}

/** decal atlas: LANTERN | EURYDICE HX-01 | crew plate | mission patch */
export const DECAL_UV = { name: [0, 0.625, 1, 1], id: [0, 0.41, 1, 0.625], crew: [0.0156, 0.0234, 0.484, 0.375], patch: [0.652, 0, 0.848, 0.39] };
function decalTexture(kit) {
  return kit.canvasTexture(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    stencilText(g, 'LANTERN', w / 2, 48, 88, '#23272c', { spacing: 8 });
    g.fillStyle = '#e5742b'; g.fillRect(24, 100, w - 48, 6); g.fillStyle = '#2cb7cb'; g.fillRect(24, 110, w - 48, 3);
    g.fillStyle = '#23272c'; g.font = `800 36px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EURYDICE  \u00b7  HX-01', w / 2, 136);
    // crew plate
    g.fillStyle = 'rgba(236,233,224,0.95)'; g.fillRect(8, 160, 240, 90); g.strokeStyle = '#23272c'; g.lineWidth = 3; g.strokeRect(8, 160, 240, 90);
    g.fillStyle = '#23272c'; g.textAlign = 'left'; g.font = `700 18px ${SANS}`; g.fillText('CDR   E. VARIS', 20, 190); g.fillText('FE    T. OYELARAN', 20, 218); g.fillStyle = '#e5742b'; g.fillRect(20, 232, 216, 4);
    // patch: lyre on navy
    const cx = 384, cy = 207, R = 46;
    g.fillStyle = '#e5742b'; g.beginPath(); g.arc(cx, cy, R + 4, 0, TAU); g.fill(); g.fillStyle = '#1b2a4a'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    g.strokeStyle = '#2cb7cb'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R - 6, 0, TAU); g.stroke();
    g.strokeStyle = '#e7c25a'; g.lineWidth = 3.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 17, cy - 22); g.bezierCurveTo(cx - 24, cy + 4, cx - 14, cy + 22, cx, cy + 24); g.bezierCurveTo(cx + 14, cy + 22, cx + 24, cy + 4, cx + 17, cy - 22); g.stroke();
    g.lineWidth = 1.6; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(cx + i * 6.5, cy - 20); g.lineTo(cx + i * 6.5, cy + 18); g.stroke(); }
    g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 19, cy - 22); g.lineTo(cx + 19, cy - 22); g.stroke();
  }, { wrap: false, aniso: 8 });
}

function burnTexture(kit) {
  const rnd = kit.rng('lander.burn');
  return kit.canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.translate(w / 2, h / 2);
    const R = w / 2, rg = g.createRadialGradient(0, 0, 0, 0, 0, R);   // vitrified bloom ring (pale) + soot core
    rg.addColorStop(0, 'rgba(8,10,16,0.55)'); rg.addColorStop(0.35, 'rgba(10,12,20,0.42)'); rg.addColorStop(0.52, 'rgba(120,160,190,0.30)'); rg.addColorStop(0.62, 'rgba(150,190,220,0.16)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(-R, -R, w, h);
    for (let i = 0; i < 210; i++) {                                    // radial blast streaks
      const a = rnd() * TAU, r0 = R * (0.22 + rnd() * 0.2), r1 = R * (0.55 + rnd() * 0.45), gr = g.createLinearGradient(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1);
      const dark = rnd() < 0.62; gr.addColorStop(0, dark ? 'rgba(6,8,14,0.34)' : 'rgba(170,205,230,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.strokeStyle = gr; g.lineWidth = 0.6 + rnd() * 2.2; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
    }
  }, { wrap: false, aniso: 4 });
}

// ─────────────────────────────── builder ───────────────────────────────
export function buildLander(env, slot, L) {
  const { kit } = env;
  const kb = new Kb(73).bind(env, L), M = baseMats(kit), rnd = kit.rng('lander');
  const group = new THREE.Group(); group.name = 'elysium.lander';
  const colliders = [], interactables = [], ups = [], sun = env.sunDir.clone();
  const LY = 0.34;                                          // the hatch faces the player's approach, a little to the right
  const cylC = (lx, lz, r, y0, y1) => { const [x, z] = L.xz(lx, lz); colliders.push(kit.cyl(x, z, r, y0, y1)); };
  const gy = L.gy0, ca = Math.cos(L.yaw + LY), sa = Math.sin(L.yaw + LY);
  const wxz = (px, pz) => [slot.x + px * ca + pz * sa, slot.z - px * sa + pz * ca];     // lander-local → world XZ

  kb.at(0, 0, LY);
  const R = 1.85, AP = R * Math.cos(PI / 6), Y0 = 0.95, Y1 = 2.45, YM = (Y0 + Y1) / 2;

  // ── descent stage: carbon core, six gold-foil panels, corner posts, bands, deck ──
  kb.add('paint', new THREE.CylinderGeometry(R * 0.985, R * 0.985, Y1 - Y0, 6), [0, YM, 0], [0, PI / 6, 0], 1, 0x2b2e33);
  for (let k = 0; k < 6; k++) {
    const a = k * PI / 3, nx = Math.sin(a), nz = Math.cos(a), ac = a + PI / 6;
    kb.add('foil', new THREE.BoxGeometry(1.66, 1.3, 0.1), [nx * (AP + 0.04), YM, nz * (AP + 0.04)], [0, a, 0], 1, 0xffffff);
    kb.box('metal', 0.13, Y1 - Y0 + 0.08, 0.13, [Math.sin(ac) * R, YM, Math.cos(ac) * R], [0, ac, 0], 0x3a3f46);
    for (const yy of [Y0 + 0.02, Y1 - 0.02]) kb.box('metal', 1.7, 0.07, 0.06, [nx * (AP + 0.075), yy, nz * (AP + 0.075)], [0, a, 0], 0x555c64);
    kb.cyl('metal', 0.024, 0.024, 0.05, 6, [nx * (AP + 0.1), YM + 0.4, nz * (AP + 0.1)], [PI / 2, a, 0], K.steel);   // fasteners
  }
  for (const [k, w, h] of [[5, 1.5, 0.46], [1, 1.5, 0.3]]) { const a = k * PI / 3; kb.box('paint', w, h, 0.012, [Math.sin(a) * (AP + 0.098), YM + 0.3, Math.cos(a) * (AP + 0.098)], [0, a, 0], 0xd7dadb); }   // name plates on two foil panels
  kb.add('paint', new THREE.CylinderGeometry(R, R, 0.1, 6), [0, Y1 + 0.05, 0], [0, PI / 6, 0], 1, K.deck);            // deck
  kb.add('paint', new THREE.CylinderGeometry(R * 0.96, R * 0.96, 0.06, 6), [0, Y0 - 0.03, 0], [0, PI / 6, 0], 1, 0x20232a);
  // engine bell + gimbal ring
  kb.cyl('metal', 0.3, 0.74, 0.7, 28, [0, Y0 - 0.35, 0], null, 0x3b4046); kb.cyl('metal', 0.76, 0.76, 0.06, 28, [0, Y0 - 0.7, 0], null, 0x6d747b);
  kb.add('paint', flipped(new THREE.CylinderGeometry(0.27, 0.68, 0.66, 24, 1, true)), [0, Y0 - 0.37, 0], null, 1, 0x101215);   // inside of the bell, seen from below
  kb.torus('metal', 0.5, 0.05, [0, Y0 - 0.02, 0], [PI / 2, 0, 0], 0x6d747b, TAU, [6, 24]);

  // ── landing legs ──
  const FR = 3.55, feet = [];
  for (let k = 0; k < 4; k++) {
    const b = PI / 4 + k * PI / 2, dx = Math.sin(b), dz = Math.cos(b);
    const top = [dx * 1.5, 2.1, dz * 1.5], foot = [dx * FR, 0.17, dz * FR], lerp3 = (t) => [lerp(top[0], foot[0], t), lerp(top[1], foot[1], t), lerp(top[2], foot[2], t)];
    kb.rod('metal', top, foot, 0.075, 0.05, 0x666d75, 8);
    kb.rod('foil', lerp3(0.04), lerp3(0.58), 0.115, 0.1, 0xffffff, 8);                                      // foil-wrapped upper strut
    kb.rod('metal', [dx * 1.12, 1.08, dz * 1.12], lerp3(0.66), 0.045, 0.045, 0x666d75, 6);               // secondary strut
    kb.cyl('metal', 0.1, 0.1, 0.1, 8, [top[0], top[1], top[2]], null, 0x444a51);
    kb.cyl('metal', 0.12, 0.5, 0.16, 20, [foot[0], 0.1, foot[2]], null, 0x70777e); kb.cyl('metal', 0.5, 0.5, 0.035, 20, [foot[0], 0.03, foot[2]], null, 0x59606a);
    kb.cyl('metal', 0.05, 0.05, 0.12, 6, [foot[0], 0.22, foot[2]], null, K.steel);
    feet.push([foot[0], foot[2]]);
  }

  // ── crew pod ──
  const PY0 = 2.53, PH = 1.5, PR0 = 1.36, PR1 = 1.3;
  kb.add('hull', new THREE.CylinderGeometry(PR1, PR0, PH, 36, 1, true), [0, PY0 + PH / 2, 0], null, 1, 0xffffff);
  kb.add('hull', new THREE.SphereGeometry(PR1, 36, 10, 0, TAU, 0, PI / 2), [0, PY0 + PH, 0], null, [1, 0.42, 1], 0xffffff);
  kb.cyl('metal', 1.43, 1.43, 0.07, 36, [0, PY0 + 0.03, 0], null, 0x6b7279);
  kb.cyl('metal', 0.5, 0.58, 0.13, 24, [0, PY0 + PH + 0.55, 0], null, 0x7b838a); kb.cyl('paint', 0.4, 0.4, 0.03, 24, [0, PY0 + PH + 0.62, 0], null, 0x1c1f24);   // docking collar
  for (const [yy, r, c] of [[3.14, 1.345, K.orange], [3.3, 1.338, K.cyan]]) kb.cyl('paint', r, r, c === K.orange ? 0.1 : 0.035, 36, [0, yy, 0], null, c, true);   // livery stripes
  // windows: front pair warm-lit, rear pair dark; ring + hood
  for (const az of [-0.84, 0.84, -2.27, 2.27]) {
    const nx = Math.sin(az), nz = Math.cos(az), p = [nx * 1.322, 3.55, nz * 1.322], lit = Math.abs(az) < 1.5;
    kb.add('metal', new THREE.CylinderGeometry(0.19, 0.19, 0.05, 20), p, [PI / 2, az, 0], 1, 0x0a1118);
    kb.add('metal', new THREE.TorusGeometry(0.205, 0.04, 8, 22), [nx * 1.34, 3.55, nz * 1.34], [0, az, 0], 1, 0x8b939b);
    kb.add('metal', new THREE.TorusGeometry(0.25, 0.022, 6, 14, PI), [nx * 1.33, 3.58, nz * 1.33], [0, az, 0], 1, 0x59606a);
    if (lit) kb.add('glow', new THREE.CircleGeometry(0.17, 18), [nx * 1.352, 3.55, nz * 1.352], [0, az, 0], 1, [0.7, 0.4, 0.17]);
  }
  // RCS quads
  for (let k = 0; k < 4; k++) {
    const a = PI / 4 + k * PI / 2 + 0.25 * (k % 2 ? -1 : 1), nx = Math.sin(a), nz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
    kb.box('metal', 0.36, 0.3, 0.26, [nx * 1.42, 3.0, nz * 1.42], [0, a, 0], 0x555c64);
    for (const [ox, oy] of [[-0.1, -0.08], [0.1, -0.08], [-0.1, 0.08], [0.1, 0.08]]) kb.add('metal', new THREE.ConeGeometry(0.05, 0.12, 8, 1, true), [nx * 1.6 + tx * ox, 3.0 + oy, nz * 1.6 + tz * ox], [-PI / 2, a, 0], 1, 0x1a1d21);
    kb.box('paint', 0.26, 0.22, 0.012, [nx * 1.52 + tx * 0.0, 2.88, nz * 1.52], [0, a, 0], 0x1f2227);                  // soot patch
  }

  // ── hatch module: frame, glowing interior, lantern, opened door ──
  const hy0 = 2.62, hy1 = 3.82, hym = (hy0 + hy1) / 2, hz = 1.4;
  kb.box('metal', 1.12, 0.1, 0.64, [0, hy0 - 0.05, hz], null, 0x6d747b); kb.box('metal', 1.12, 0.1, 0.64, [0, hy1 + 0.05, hz], null, 0x6d747b);
  for (const sx of [-1, 1]) kb.box('metal', 0.1, hy1 - hy0 + 0.2, 0.64, [sx * 0.55, hym, hz], null, 0x6d747b);
  kb.box('glow', 1.0, hy1 - hy0, 0.02, [0, hym, 1.1], null, (x, y) => { const k = 1.15 - 0.4 * Math.abs(y) / 0.6; return [k * 1.0, k * 0.58, k * 0.24]; });
  for (const sx of [-1, 1]) kb.box('glow', 0.012, hy1 - hy0, 0.6, [sx * 0.497, hym, hz], null, (x, y, z) => { const k = 0.55 + 0.6 * smooth(0.3, -0.3, z); return [k * 1.0, k * 0.58, k * 0.24]; });
  kb.box('glow', 1.0, 0.012, 0.6, [0, hy1 - 0.006, hz], null, [0.9, 0.52, 0.2]); kb.box('glow', 1.0, 0.012, 0.6, [0, hy0 + 0.006, hz], null, [0.5, 0.3, 0.12]);
  kb.box('paint', 0.7, 0.4, 0.02, [-0.1, hym - 0.1, 1.12], null, 0x23272d);                                      // instrument panel
  for (let i = 0; i < 5; i++) kb.box('glow', 0.03, 0.03, 0.012, [-0.36 + i * 0.12, hym - 0.02, 1.13], null, i % 2 ? [0.3, 2.6, 1.2] : [2.8, 0.7, 0.25]);
  kb.rod('metal', [0.2, hy1, 1.4], [0.2, hy1 - 0.22, 1.4], 0.008, 0.008, K.steel, 4); kb.sph('glow', 0.09, [0.2, hy1 - 0.34, 1.4], [6.5, 3.6, 1.4], 1, [10, 8]);   // the lantern itself
  kb.cyl('metal', 0.09, 0.07, 0.025, 10, [0.2, hy1 - 0.2, 1.4], null, 0x303338); kb.cyl('metal', 0.075, 0.09, 0.025, 10, [0.2, hy1 - 0.47, 1.4], null, 0x303338);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; kb.rod('metal', [0.2 + Math.cos(a) * 0.082, hy1 - 0.205, 1.4 + Math.sin(a) * 0.082], [0.2 + Math.cos(a) * 0.082, hy1 - 0.465, 1.4 + Math.sin(a) * 0.082], 0.004, 0.004, K.steel, 3); }
  kb.sub([0.57, hym, 1.74], [0, 1.9, 0]);                                                                          // door, swung open on its hinge
  kb.box('metal', 0.92, 1.2, 0.07, [-0.46, 0, 0], null, 0xc3c7ca); kb.box('paint', 0.8, 1.08, 0.02, [-0.46, 0, -0.045], null, 0x2a2e34);
  for (const yy of [-0.4, 0.4]) kb.cyl('metal', 0.04, 0.04, 0.22, 8, [0, yy, 0], null, K.steel);
  kb.cyl('metal', 0.22, 0.22, 0.05, 18, [-0.46, 0.05, 0.05], [PI / 2, 0, 0], 0x8b939b); kb.cyl('paint', 0.16, 0.16, 0.06, 18, [-0.46, 0.05, 0.05], [PI / 2, 0, 0], 0x0a1118);
  kb.end();
  // ladder from the deck edge to the ground + grab rails
  const lz0 = 1.64, lz1 = 2.78, ly0 = 2.5;
  for (const sx of [-1, 1]) { kb.rod('metal', [sx * 0.22, ly0, lz0], [sx * 0.22, 0.03, lz1], 0.026, 0.026, 0xaab2ba, 6); kb.box('metal', 0.1, 0.04, 0.2, [sx * 0.22, 0.02, lz1 + 0.04], null, 0x59606a); kb.box('metal', 0.07, 0.07, 0.12, [sx * 0.22, ly0 + 0.02, lz0 - 0.02], null, 0x59606a); }
  for (let i = 0; i < 9; i++) { const t = (i + 0.6) / 9.4; kb.rod('metal', [-0.22, lerp(ly0, 0.03, t), lerp(lz0, lz1, t)], [0.22, lerp(ly0, 0.03, t), lerp(lz0, lz1, t)], 0.016, 0.016, 0xc9ced3, 5); }
  for (const sx of [-1, 1]) kb.rod('metal', [sx * 0.26, ly0 + 0.02, 1.62], [sx * 0.26, ly0 + 0.7, 1.62], 0.016, 0.016, 0xaab2ba, 6);
  kb.rod('metal', [-0.26, ly0 + 0.7, 1.62], [0.26, ly0 + 0.7, 1.62], 0.016, 0.016, 0xaab2ba, 6);

  // ── antennas: whip (carries the beacon), rod array on the deck, dish aimed at the galaxy ──
  const WX = -0.45, WZ = -0.35, WY0 = PY0 + PH + 0.5, WY1 = WY0 + 1.9;
  kb.rod('metal', [WX, WY0, WZ], [WX, WY1, WZ], 0.014, 0.008, 0xc9ced3, 5); kb.cyl('metal', 0.04, 0.05, 0.08, 8, [WX, WY0 + 0.02, WZ], null, 0x444a51);
  kb.rod('metal', [-1.1, Y1 + 0.1, -1.0], [-1.1, Y1 + 1.5, -1.0], 0.012, 0.01, 0xc9ced3, 5);
  for (const yy of [Y1 + 0.9, Y1 + 1.2, Y1 + 1.4]) kb.rod('metal', [-1.1 - 0.25, yy, -1.0], [-1.1 + 0.25, yy, -1.0], 0.006, 0.006, 0xc9ced3, 4);
  kb.rod('metal', [1.2, Y1 + 0.1, -0.9], [1.2, Y1 + 0.9, -0.9], 0.012, 0.01, 0xc9ced3, 5); kb.sph('metal', 0.035, [1.2, Y1 + 0.93, -0.9], 0xc9ced3);
  const [ldx, ldz] = [sun.x * ca - sun.z * sa, sun.x * sa + sun.z * ca], dir = new THREE.Vector3(ldx, Math.max(sun.y, 0.35), ldz).normalize();
  const dp = [0.75, PY0 + PH + 0.75, -0.7];
  kb.rod('metal', [0.35, PY0 + PH + 0.35, -0.5], [dp[0], dp[1] - 0.05, dp[2]], 0.02, 0.016, 0x59606a, 5);
  kb.dish('metal', 0.38, 0.11, dp, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), K.alu, 20, 4);
  kb.rod('metal', dp, [dp[0] + dir.x * 0.4, dp[1] + dir.y * 0.4, dp[2] + dir.z * 0.4], 0.008, 0.008, K.steel, 4);

  // ── materials → meshes ──
  const tFoil = foilTexture(kit), tHull = hullTexture(kit), tDecal = decalTexture(kit), tBurn = burnTexture(kit), tPrint = printTexture(kit), tGlow = glowTexture(kit);
  const mFoil = kit.std({ map: tFoil, bumpMap: tFoil, bumpScale: 2.2, color: 0xffffff, metalness: 0.38, roughness: 0.36, vertexColors: true, emissive: 0x2a2008 });
  const mHull = kit.std({ map: tHull, color: 0xffffff, metalness: 0.12, roughness: 0.55, vertexColors: true, side: THREE.DoubleSide });
  const add = (m) => { if (m) group.add(m); return m; };
  add(kb.mesh('metal', M.metal)); add(kb.mesh('paint', M.paint)); add(kb.mesh('foil', mFoil, { weather: { dust: 0.2, frost: 0.14 } })); add(kb.mesh('hull', mHull, { weather: { dust: 0.18, frost: 0.22 } }));
  add(kb.mesh('glow', M.glow, { weather: false, cast: false, receive: false }));

  // ── name plates (two stage panels) + patches (pod flanks), all cut from one alpha atlas ──
  const uvmap = (g, rect) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, rect[0] + uv.getX(i) * (rect[2] - rect[0]), rect[1] + uv.getY(i) * (rect[3] - rect[1])); return g; };
  const patch = (r, y0, y1, a0, a1, rect) => uvmap(new THREE.CylinderGeometry(r, r, y1 - y0, 14, 1, true, a0, a1 - a0), rect).translate(0, (y0 + y1) / 2, 0);
  const flat = (w, h, a, rad, y, rect) => uvmap(new THREE.PlaneGeometry(w, h), rect).rotateY(a).translate(Math.sin(a) * rad, y, Math.cos(a) * rad);
  const dMat = env.fog(new THREE.MeshStandardMaterial({ map: tDecal, transparent: true, depthWrite: false, roughness: 0.6, metalness: 0.1, alphaTest: 0.02 }));
  const dr = AP + 0.1085, decalGeos = [
    flat(1.42, 0.2663, -PI / 3, dr, YM + 0.3, DECAL_UV.name), flat(1.4, 0.15, PI / 3, dr, YM + 0.3, DECAL_UV.id),
    patch(1.334, 3.28, 3.52, 1.28, 1.76, DECAL_UV.crew), patch(1.334, 3.2, 3.62, -1.78, -1.46, DECAL_UV.patch),
  ];
  for (const g of decalGeos) g.applyMatrix4(kb.F);                         // built in lander-local space → world
  const dm = new THREE.Mesh(mergeDecals(decalGeos), dMat); dm.renderOrder = 1; group.add(dm);

  // ── ground: vitrified exhaust ring + warm light spill + boot prints ──
  const [cx, cz] = wxz(0, 0);
  const burn = decalQuad(env, cx, cz, 6.4, 6.4, L.yaw + LY, 0.012, [1, 1, 1], 6);
  const bm = new THREE.Mesh(burn, kit.std({ map: tBurn, transparent: true, depthWrite: false, roughness: 0.4, metalness: 0.2, color: 0xffffff })); bm.renderOrder = 0; group.add(bm);
  const [sx, sz] = wxz(0.2, 3.6), glowG = [decalQuad(env, sx, sz, 3.3, 2.6, L.yaw + LY, 0.02, [0.55, 0.27, 0.09]), decalQuad(env, ...wxz(1.55, 2.5), 1.2, 1.2, 0, 0.022, [0.24, 0.12, 0.04])];
  const gd = new THREE.Mesh(mergeDecals(glowG), decalMat(tGlow)); gd.renderOrder = 2; group.add(gd);
  const camp = env.slots?.camp, paths = [{ pts: [[0.1, 3.4], [-0.2, 4.6]], s: 1 }, { pts: [[0.5, 3.2], [1.9, 2.9], [2.3, 2.5]], s: -1 }];
  if (camp) { const [lx, lz] = L.local(camp.x, camp.z), d = Math.hypot(lx, lz), ux = lx / d, uz = lz / d; const pts = []; for (let r = 4.4; r <= 11.4; r += 1.7) pts.push([ux * r + -uz * Math.sin(r * 0.6) * 0.8, uz * r + ux * Math.sin(r * 0.6) * 0.8]); paths.push({ pts, s: -1, stride: 0.8 }); }
  const pg = printsGeo(env, L, paths, rnd);
  if (pg) { const pm = new THREE.Mesh(pg, kit.std({ map: tPrint, color: 0x07090e, transparent: true, opacity: 0.8, depthWrite: false, roughness: 1, metalness: 0, alphaTest: 0.02 })); pm.renderOrder = 3; group.add(pm); }

  // ── hanging work-lamp (swings gently), warm hatch light, beacon ──
  const lampG = new THREE.Group();
  { const lk = new Kb(5); lk.frame(0, 0, 0, 0);
    lk.rod('mc', [0, 0, 0], [0, -0.42, 0], 0.006, 0.006, K.rubber, 4); lk.cyl('mc', 0.045, 0.06, 0.05, 10, [0, -0.45, 0], null, 0x59606a); lk.cyl('mc', 0.075, 0.06, 0.03, 10, [0, -0.5, 0], null, 0x59606a);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; lk.rod('mc', [Math.cos(a) * 0.06, -0.5, Math.sin(a) * 0.06], [Math.cos(a) * 0.05, -0.66, Math.sin(a) * 0.05], 0.004, 0.004, 0x59606a, 3); }
    lk.cyl('mc', 0.045, 0.045, 0.02, 10, [0, -0.67, 0], null, 0x59606a); lk.sph('lg', 0.055, [0, -0.58, 0], HOT(1.5), 1, [10, 8]);
    const m1 = lk.mesh('mc', M.metal, { weather: false, cast: false }), m2 = lk.mesh('lg', M.glow, { weather: false, cast: false });
    for (const m of [m1, m2]) if (m) { m.matrixAutoUpdate = true; lampG.add(m); } }
  const [lw0x, lw0z] = wxz(0.62, 1.7); lampG.position.set(lw0x, L.gy(0, 0) + 2.55, lw0z); lampG.rotation.y = L.yaw + LY; group.add(lampG);
  const hatchLight = kit.pointLight(0xffa24a, 12, 11, [0, 0, 0]); { const [hx, hz2] = wxz(0, 2.1); hatchLight.position.set(hx, gy + 3.2, hz2); } group.add(hatchLight);
  const [bx, bz] = wxz(WX, WZ), beacon = kit.beacon([bx, gy + WY1 + 0.04, bz], { color: 0xb8e4ff, size: 0.13, lightI: 7, range: 20, period: 4.1, duty: 0.38, phase: 0.62 }); group.add(beacon.group);

  // ── TOMAS's recorder at the front-right footpad ──
  const rec = consolidate(recorderStyle(kit.recorder({ title: 'TOMAS', sub: 'LANTERN LOG', accent: '#7ae0ff' }), 0x66727e, 0x2aa8c8));
  { const [rx, rz] = wxz(2.15, 2.15); rec.position.set(rx, env.groundY(rx, rz) + 0.61, rz); rec.rotation.set(0, L.yaw + LY + 0.5, 0); kit.shadows(rec, true, true); group.add(rec); }
  // tiny orange tether from the recorder to the foot
  interactables.push(kit.interactable({ id: 'log.elysium.2', label: 'Play TOMAS\u2019s recorder', pos: rec.position.clone().add(new THREE.Vector3(0, 0.1, 0)), radius: 2.4, object: rec, lineId: 'log.elysium.2', log: true, codex: ['vessel.lantern'] }));

  // ── colliders: body, foot pads, ladder foot ──
  { const [bx2, bz2] = wxz(0, 0); colliders.push(kit.cyl(bx2, bz2, 1.95, gy + 0.9, gy + 4.7)); }
  for (const [fx, fz] of feet) { const [x, z] = wxz(fx, fz); colliders.push(kit.cyl(x, z, 0.5, gy, gy + 1.0)); }

  const hl0 = hatchLight.intensity;
  ups.push((dt, t) => {
    beacon.update(t); rec.userData.ledUpdate?.(t);
    lampG.rotation.z = 0.05 * Math.sin(t * 1.3) + 0.02 * Math.sin(t * 3.1); lampG.rotation.x = 0.04 * Math.sin(t * 0.9 + 1.0);
    hatchLight.intensity = hl0 * (1 + 0.025 * Math.sin(t * 2.2) * Math.sin(t * 0.7));
  });
  return { group, interactables, colliders, update: (dt, t, cam) => { for (const u of ups) u(dt, t, cam); } };
}
