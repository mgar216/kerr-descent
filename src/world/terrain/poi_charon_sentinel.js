// ORPHEUS · Charon / Sentinel Observatory (slot `telescope`, padR 24) — Dr. Ilse Varga's telescope that has watched EURYDICE's frozen image for eleven years.
// Dome + telescope: poi_charon_dome.js · annex, corridor, kiosk: poi_charon_annex.js · ghost screen: poi_charon_screen.js · helpers: poi_charon_icekit.js
// Airless: no wind — nothing sways; machines move (dome slews, dish tracks), screens and beacons pulse. Razor shadows, black sky: emissive accents carry the shade side.
import * as THREE from 'three';
import { GM, makeFrame, makeBatch, paintTexture, foilTexture, brushedTexture, bootsTexture, rbox, rockGeo, strut, tubeGeo, lathe, obbBoxes, ribbon, groundPatch, mergeAll, identityFrame } from './poi_charon_icekit.js';
import { buildDome } from './poi_charon_dome.js';
import { buildAnnex, ANNEX, KIOSK } from './poi_charon_annex.js';

const DOME_AT = { x: -4.5, z: -9.5 };
const RTG_AT = { x: -17.2, z: -8.8 };
const DISH_AT = { x: 20.9, z: -0.6 };
const MAST_AT = { x: 14.8, z: -11.2 };
const SOLAR_AT = { x: -14.2, z: 4.6 };

const box = GM.Box, cyl = (a, b, h, n = 12) => GM.Cylinder(a, b, h, n);

// ───────────────────────────── textures ─────────────────────────────
const SIGN_RECTS = { banner: [0, 0, 512, 72], rot: [0, 80, 256, 120], rot2: [0, 210, 256, 80], rad: [264, 80, 120, 120], hv: [392, 80, 120, 120], airlock: [0, 300, 256, 100], kiosk: [264, 210, 248, 80], rf: [264, 300, 248, 100], pad: [0, 410, 256, 90] };

function signAtlas(kit) {
  return kit.canvasTexture(512, 512, (g, W, H) => {
    g.fillStyle = '#20242a'; g.fillRect(0, 0, W, H);
    const font = (px, w = 700) => `${w} ${px}px Rajdhani, "Segoe UI", Arial, sans-serif`;
    let mw = 480;
    const txt = (s, x, y, px, col, w = 700, ls = 0) => {
      g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
      const set = (p) => { g.font = font(p, w); try { g.letterSpacing = ls * p / px + 'px'; } catch { /* optional */ } };
      set(px); const tw = g.measureText(s).width; if (tw > mw) set(px * mw / tw);
      g.fillText(s, x, y); try { g.letterSpacing = '0px'; } catch { /* optional */ }
    };
    const R = SIGN_RECTS;
    let [x, y, w, h] = R.banner; mw = w - 40; mw = w - 22;
    g.fillStyle = '#13171c'; g.fillRect(x, y, w, h); g.fillStyle = '#e36a14'; g.fillRect(x, y + h - 7, w, 5); g.fillRect(x, y, w, 3);
    txt('SENTINEL OBSERVATORY', x + w / 2, y + 30, 40, '#eef3f6', 700, 5); txt('HALCYON SCIENCE DIRECTORATE · LONG-BASELINE HORIZON WATCH', x + w / 2, y + 56, 13, '#9fb4c0', 500, 1.5);
    [x, y, w, h] = R.rot; mw = w - 22; g.fillStyle = '#f0b400'; g.fillRect(x, y, w, h); g.strokeStyle = '#15171a'; g.lineWidth = 6; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    txt('CAUTION', x + w / 2, y + 34, 44, '#15171a', 800, 3); txt('ROTATING DOME', x + w / 2, y + 70, 30, '#15171a', 700, 2); txt('KEEP CLEAR OF SLIT TRACK', x + w / 2, y + 98, 13, '#15171a', 600, 1);
    [x, y, w, h] = R.rot2; mw = w - 22; g.fillStyle = '#16191e'; g.fillRect(x, y, w, h); g.strokeStyle = '#e36a14'; g.lineWidth = 4; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
    txt('SERVICE ACCESS', x + w / 2, y + 31, 30, '#e36a14', 700, 2); txt('KEEP CLEAR · THERMAL VENT', x + w / 2, y + 58, 14, '#cfd8de', 500, 1);
    [x, y, w, h] = R.rad; mw = w - 22; g.fillStyle = '#f0b400'; g.fillRect(x, y, w, h); g.strokeStyle = '#15171a'; g.lineWidth = 5; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    g.save(); g.translate(x + w / 2, y + h / 2 - 6); g.fillStyle = '#15171a';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 36, i * 2.094 + 0.52, i * 2.094 + 0.52 + 1.047); g.closePath(); g.fill(); }
    g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fillStyle = '#f0b400'; g.fill(); g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fillStyle = '#15171a'; g.fill(); g.restore();
    txt('RTG', x + w / 2, y + h - 14, 18, '#15171a', 800, 2);
    [x, y, w, h] = R.hv; mw = w - 22; g.fillStyle = '#c4281c'; g.fillRect(x, y, w, h); g.strokeStyle = '#f2f2f0'; g.lineWidth = 5; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    g.fillStyle = '#f2f2f0'; g.beginPath(); g.moveTo(x + 64, y + 22); g.lineTo(x + 40, y + 62); g.lineTo(x + 58, y + 62); g.lineTo(x + 50, y + 94); g.lineTo(x + 82, y + 50); g.lineTo(x + 63, y + 50); g.closePath(); g.fill();
    txt('HIGH VOLTAGE', x + w / 2, y + 108, 13, '#f2f2f0', 800, 0.5);
    [x, y, w, h] = R.airlock; mw = w - 22; g.fillStyle = '#16191e'; g.fillRect(x, y, w, h); g.fillStyle = '#3ec878'; g.fillRect(x, y, 8, h);
    txt('AIRLOCK 1', x + w / 2 + 4, y + 36, 46, '#eef3f6', 700, 3); txt('CYCLE BEFORE ENTRY · SUIT CHECK', x + w / 2 + 4, y + 76, 15, '#9fb4c0', 500, 1);
    [x, y, w, h] = R.kiosk; mw = w - 22; g.fillStyle = '#0d141a'; g.fillRect(x, y, w, h); g.strokeStyle = '#4aa8d4'; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    txt('LONG EXPOSURE', x + w / 2, y + 22, 26, '#a9dcf2', 700, 3); txt('IN PROGRESS', x + w / 2, y + 47, 24, '#a9dcf2', 600, 3); txt('PLEASE KEEP LIGHTS LOW', x + w / 2, y + 68, 13, '#6fa9c4', 500, 1.5);
    [x, y, w, h] = R.rf; mw = w - 22; g.fillStyle = '#f0b400'; g.fillRect(x, y, w, h); g.strokeStyle = '#15171a'; g.lineWidth = 6; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    txt('RF HAZARD', x + w / 2, y + 36, 40, '#15171a', 800, 3); txt('ANTENNA ARRAY · DO NOT APPROACH', x + w / 2, y + 74, 16, '#15171a', 600, 1);
    [x, y, w, h] = R.pad; mw = w - 22; g.fillStyle = '#242a31'; g.fillRect(x, y, w, h); g.strokeStyle = '#7e8a94'; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    txt('SOLAR ARRAY 2', x + w / 2, y + 32, 34, '#d7dee3', 700, 2); txt('SUN-TRACKING · KEEP OFF', x + w / 2, y + 64, 15, '#8fa0ac', 500, 1);
  }, { wrap: false, aniso: 8 });
}

const radiatorTexture = (kit) => kit.canvasTexture(256, 112, (g, W, H) => {
  g.fillStyle = '#e8eaeb'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(40,44,50,0.45)'; g.lineWidth = 1.4;
  for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * W / 8, 0); g.lineTo(i * W / 8, H); g.stroke(); }
  for (let j = 0; j < 14; j++) { const y = 9 + j * 7; g.fillStyle = 'rgba(30,34,42,0.55)'; g.fillRect(10, y, W - 20, 2.8); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(10, y + 2.8, W - 20, 0.9); }
  g.fillStyle = 'rgba(40,44,52,0.8)'; g.fillRect(3, 5, 6, H - 10); g.fillRect(W - 9, 5, 6, H - 10);
  g.strokeStyle = 'rgba(70,76,84,0.9)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3);
  kit.grime(g, W, H, { amount: 0.5, streaks: 8, seed: 21 });
}, { wrap: false, aniso: 8 });

const solarTexture = (kit) => kit.canvasTexture(256, 192, (g, W, H) => {
  const r = kit.mulberry32(5);
  g.fillStyle = '#d9dcde'; g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0d1738'); gr.addColorStop(1, '#16254f'); g.fillStyle = gr; g.fillRect(6, 6, W - 12, H - 12);
  const cw = (W - 12) / 8, ch = (H - 12) / 6;
  for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) { const t = (r() - 0.5) * 0.22; g.fillStyle = t > 0 ? `rgba(120,150,230,${t * 0.5})` : `rgba(0,0,10,${-t})`; g.fillRect(6 + i * cw + 1, 6 + j * ch + 1, cw - 2, ch - 2); }
  g.strokeStyle = 'rgba(180,196,225,0.6)'; g.lineWidth = 1.2;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(6 + i * cw, 6); g.lineTo(6 + i * cw, H - 6); g.stroke(); }
  for (let j = 0; j <= 6; j++) { g.beginPath(); g.moveTo(6, 6 + j * ch); g.lineTo(W - 6, 6 + j * ch); g.stroke(); }
  g.strokeStyle = 'rgba(210,220,240,0.28)'; g.lineWidth = 0.7;
  for (let i = 0; i < 8; i++) for (const f of [0.33, 0.66]) { g.beginPath(); g.moveTo(6 + i * cw + cw * f, 6); g.lineTo(6 + i * cw + cw * f, H - 6); g.stroke(); }
  const sh = g.createLinearGradient(0, 0, W, H * 0.6); sh.addColorStop(0.3, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.09)'); sh.addColorStop(0.7, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(80,86,94,0.8)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3);
}, { wrap: false, aniso: 8 });

const trenchTexture = (kit) => kit.canvasTexture(256, 64, (g, W, H) => {
  g.fillStyle = '#74777c'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#131518'; g.fillRect(0, 7, W, H - 14);
  for (const [y, c, t] of [[20, '#e0701a', 7], [31, '#2c78c8', 6], [42, '#303338', 7]]) { g.fillStyle = c; g.fillRect(0, y, W, t); g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, y + 1, W, 1.4); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + t - 1.4, W, 1.4); }
  for (const x0 of [112, 240]) { g.fillStyle = '#9096a0'; g.fillRect(x0, 4, 22, H - 8); g.fillStyle = 'rgba(0,0,0,0.4)'; g.strokeRect(x0 + 0.5, 4.5, 21, H - 9); for (const [bx, by] of [[x0 + 4, 10], [x0 + 18, 10], [x0 + 4, H - 10], [x0 + 18, H - 10]]) { g.fillStyle = '#4c5056'; g.beginPath(); g.arc(bx, by, 1.8, 0, 7); g.fill(); } }
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 7, W, 3); g.fillRect(0, H - 10, W, 3);
}, { aniso: 4 });

const tracksTexture = (kit) => kit.canvasTexture(64, 128, (g, W, H) => {
  const r = kit.mulberry32(8);
  g.clearRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.18, 'rgba(10,9,8,0.42)'); gr.addColorStop(0.82, 'rgba(10,9,8,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 8) { g.strokeStyle = `rgba(0,0,0,${0.35 + r() * 0.2})`; g.lineWidth = 2.6; g.beginPath(); g.moveTo(10, y); g.lineTo(32, y + 4); g.lineTo(54, y); g.stroke(); g.strokeStyle = 'rgba(190,184,176,0.20)'; g.lineWidth = 1; g.beginPath(); g.moveTo(10, y + 3); g.lineTo(32, y + 7); g.lineTo(54, y + 3); g.stroke(); }
}, { aniso: 4 });

// ───────────────────────────── build ─────────────────────────────
export function buildSentinel(env, slot) {
  const { kit } = env, fr = makeFrame(env, slot), group = new THREE.Group(); group.name = 'sentinel';
  const colliders = [], updaters = [], rng = kit.rng('sentinel');
  const S = (o) => kit.std({ color: 0xffffff, ...o });

  const tex = {
    hull: paintTexture(kit, { base: '#dcdfe0', seed: 3, pits: 0.5, wear: 0.7, grimeAmt: 0.45 }),
    dome: paintTexture(kit, { base: '#e7e9ea', seed: 11, pits: 0.8, wear: 0.4, streaks: 22, grimeAmt: 0.5 }),
    foil: foilTexture(kit, { seed: 9 }),
    brushed: brushedTexture(kit, { dir: 'u', base: '#c2c8ce' }),
    haz: kit.stripeTexture({ a: '#f0b400', b: '#17191c', n: 8, w: 256, h: 64 }),
    rad: radiatorTexture(kit), solar: solarTexture(kit), sign: signAtlas(kit),
  };
  const mat = {
    paint: S({ map: tex.hull, vertexColors: true, roughness: 0.6, metalness: 0.08 }),
    metal: S({ map: tex.brushed, vertexColors: true, roughness: 0.36, metalness: 0.6 }),
    dark: S({ map: tex.hull, vertexColors: true, roughness: 0.82, metalness: 0.12 }),
    foil: S({ map: tex.foil, bumpMap: tex.foil, bumpScale: 2.2, vertexColors: true, roughness: 0.3, metalness: 0.7 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
    haz: S({ map: tex.haz, vertexColors: true, roughness: 0.55, metalness: 0.05 }),
    sign: S({ map: tex.sign, vertexColors: true, roughness: 0.5, metalness: 0.15 }),
    rad: S({ map: tex.rad, vertexColors: true, roughness: 0.5, metalness: 0.1 }),
    solar: S({ map: tex.solar, vertexColors: true, roughness: 0.25, metalness: 0.4 }),
    rock: S({ vertexColors: true, roughness: 0.93 }),
    domePaint: S({ map: tex.dome, roughness: 0.52, metalness: 0.12 }),
    domeIn: S({ color: 0x2c3036, roughness: 0.85 }),
    domeMetal: S({ map: tex.brushed, roughness: 0.35, metalness: 0.65 }),
    scopeBody: S({ vertexColors: true, roughness: 0.42, metalness: 0.4 }),
    mirror: S({ color: 0x0a0c10, roughness: 0.05, metalness: 0.95 }),
    dish: S({ map: tex.hull, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide }),
  };
  const HINT = { P: 60000, M: 50000, D: 30000, G: 10000, H: 6000, F: 12000, RAD: 800, SIGN: 2000, SOL: 1500, R: 25000 }, bat = {};
  for (const k of Object.keys(HINT)) bat[k] = makeBatch(fr, HINT[k]);

  const B = {
    env, kit, fr, group, colliders, updaters, rng, tex, mat, bat,
    /** add a quad / curved strip to the sign batch, remapping its UVs to a plate of the atlas (canvas y grows downward, texture is flipY) */
    sign(geo, name, o = {}) {
      const [x, y, w, h] = SIGN_RECTS[name], uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * w) / 512, 1 - (y + (1 - uv.getY(i)) * h) / 512);
      return bat.SIGN.add(geo, { ...o, uv: 0 });
    },
  };

  // ── main structures ──
  const dome = buildDome(B, DOME_AT.x, DOME_AT.z);
  const annex = buildAnnex(B, DOME_AT);

  // ── plaza slab, paint lines ──
  bat.P.add(rbox(25.5, 0.4, 7.4, 0.08), { p: [5.9, -0.1, 2.3], color: 0x7c8086, dirt: 0.0 });
  for (const z of [5.75, -0.95]) for (let x = -6.4; x < 18.4; x += 1.7) bat.P.add(box(0.9, 0.012, 0.16), { p: [x + 0.45, 0.108, z], color: 0xe8b21a, uv: 0 });

  // ── entrance signboard ──
  {
    const sx = -7.3, sz = 5.0, ry = 0.5, c = Math.cos(ry), sn = Math.sin(ry);
    bat.D.add(box(3.5, 0.58, 0.07), { p: [sx, 1.2, sz], r: [0, ry, 0], color: 0x2a2e33 });
    B.sign(new THREE.PlaneGeometry(3.4, 0.478), 'banner', { p: [sx + sn * 0.037, 1.2, sz + c * 0.037], r: [0, ry, 0] });
    for (const k of [-1, 1]) { const px = sx + c * 1.5 * k, pz = sz - sn * 1.5 * k; bat.M.add(cyl(0.045, 0.045, 1.5, 8), { p: [px, 0.75, pz], color: 0x8e949a }); bat.D.add(box(0.3, 0.1, 0.3), { p: [px, 0.04, pz], color: 0x55595f }); colliders.push(kit.cyl(fr.wx(px, pz), fr.wz(px, pz), 0.08, fr.y0, fr.y0 + 1.6)); }
    bat.G.add(box(3.3, 0.03, 0.03), { p: [sx - sn * 0.0, 1.5, sz + c * 0.03], r: [0, ry, 0], color: [2.4, 1.2, 0.5], uv: 0 });
  }

  // ── solar array (6 sun-tracking panels) ──
  {
    const sd = fr.dirL(env.sunDir.x, env.sunDir.z), th = Math.atan2(sd[0], sd[1]), tilt = 1.0;
    const cols = [-3.5, 0, 3.5], rows = [0, -4.4], ang = 0.34, ca = Math.cos(ang), sa = Math.sin(ang);
    for (const rz of rows) for (const cx of cols) {
      const lx = SOLAR_AT.x + cx * ca + rz * sa, lz = SOLAR_AT.z - cx * sa + rz * ca;
      const py = 0.55 + 0.95 * Math.sin(tilt) + 0.04;
      bat.SOL.add(box(3.1, 0.05, 1.9), { p: [lx, py, lz], r: [tilt, th, 0], uv: 0, color: 0xffffff });
      bat.M.add(box(3.2, 0.07, 0.07), { p: [lx - Math.sin(th) * 0.0, py - 0.0, lz], r: [tilt, th, 0], color: 0xaab0b6, uv: 0.5 });
      // A-frame: two rear legs + front feet + cross rail
      const fx = Math.sin(th), fz = Math.cos(th), rx = Math.cos(th), rz2 = -Math.sin(th);
      for (const s of [-1, 1]) {
        const topX = lx - fx * 0.45 + rx * s * 1.2, topZ = lz - fz * 0.45 + rz2 * s * 1.2, topY = py + 0.55;
        bat.M.add(strut([topX, topY, topZ], [topX - fx * 0.9, 0.12, topZ - fz * 0.9], 0.045), { uv: 0, color: 0xaab0b6 });
        bat.M.add(strut([lx + fx * 0.5 + rx * s * 1.2, py - 0.78, lz + fz * 0.5 + rz2 * s * 1.2], [lx + fx * 0.56 + rx * s * 1.2, 0.1, lz + fz * 0.56 + rz2 * s * 1.2], 0.04), { uv: 0, color: 0xaab0b6 });
        bat.D.add(box(0.3, 0.12, 0.42), { p: [topX - fx * 0.9, 0.08, topZ - fz * 0.9], color: 0x4a4e54 });
        bat.D.add(box(0.28, 0.1, 0.34), { p: [lx + fx * 0.66 + rx * s * 1.2, 0.07, lz + fz * 0.66 + rz2 * s * 1.2], color: 0x4a4e54 });
      }
      bat.M.add(strut([lx - fx * 0.45 - rx * 1.2, py + 0.55, lz - fz * 0.45 - rz2 * 1.2], [lx - fx * 0.45 + rx * 1.2, py + 0.55, lz - fz * 0.45 + rz2 * 1.2], 0.035), { uv: 0, color: 0xaab0b6 });
      colliders.push(...obbBoxes(fr, lx, lz, 1.6, 1.0, 0, 2.2, th, 0.9));
    }
    B.sign(new THREE.PlaneGeometry(0.9, 0.2), 'pad', { p: [SOLAR_AT.x + 4.6, 0.62, SOLAR_AT.z + 3.2], r: [0, 0.6, 0], uv: 0 });
    bat.M.add(GM.Cylinder(0.03, 0.03, 0.55, 6), { p: [SOLAR_AT.x + 4.6, 0.3, SOLAR_AT.z + 3.2 - 0.02], color: 0xaab0b6 });
  }

  // ── equipment cluster on the plaza: crates, gas-bottle rack ──
  {
    const x = -2.6, z = 4.3, py = 0.1;
    bat.P.add(rbox(1.1, 0.85, 0.85, 0.04), { p: [x, py + 0.425, z], r: [0, 0.2, 0], color: 0xe36a14 });
    bat.D.add(box(1.14, 0.05, 0.89), { p: [x, py + 0.5, z], r: [0, 0.2, 0], color: 0x2c3036 });
    bat.P.add(rbox(0.8, 0.6, 0.7, 0.04), { p: [x + 0.12, py + 0.85 + 0.3, z + 0.02], r: [0, -0.15, 0], color: 0xcdd2d6 });
    bat.P.add(rbox(1.0, 0.7, 0.7, 0.04), { p: [x + 1.35, py + 0.35, z + 0.3], r: [0, 0.5, 0], color: 0x8e979f });
    bat.G.add(box(0.05, 0.05, 0.02), { p: [x + 1.35 + 0.3, py + 0.5, z + 0.3 + 0.28], r: [0, 0.5, 0], color: [0.5, 5, 1.2], uv: 0 });
    const gx = x - 1.7, gz = z - 0.1;
    bat.M.add(box(1.5, 0.05, 0.42), { p: [gx, py + 0.18, gz], color: 0x6c7076 });
    for (const sx of [-0.7, 0.7]) bat.M.add(cyl(0.025, 0.025, 1.15, 6), { p: [gx + sx, py + 0.6, gz - 0.2], color: 0x8e949a });
    [0xe8eaec, 0x2a6aa8, 0x3a8a4a, 0xd9dcdf].forEach((col, i) => {
      const bx = gx - 0.5 + i * 0.33;
      bat.P.add(cyl(0.105, 0.105, 0.95, 14), { p: [bx, py + 0.2 + 0.475, gz], color: col, uv: 0 });
      bat.P.add(GM.Sphere(0.105, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), { p: [bx, py + 1.15, gz], color: col, uv: 0 });
      bat.M.add(cyl(0.03, 0.03, 0.1, 8), { p: [bx, py + 1.27, gz], color: 0xc4cad0, uv: 0 });
      bat.D.add(cyl(0.107, 0.107, 0.05, 14), { p: [bx, py + 0.5, gz], color: 0x30343a, uv: 0 });
    });
    bat.M.add(tubeGeo([[gx - 0.7, py + 0.9, gz + 0.12], [gx, py + 0.82, gz + 0.14], [gx + 0.7, py + 0.9, gz + 0.12]], 0.01, 5, 10), { uv: 0, color: 0x2a2d32 });
    colliders.push(...obbBoxes(fr, x + 0.6, z, 1.0, 0.55, 0, 1.6, 0.2), ...obbBoxes(fr, gx, gz, 0.8, 0.25, 0, 1.4));
  }

  // ── RTG with bollard-and-chain fence ──
  {
    const x = RTG_AT.x, z = RTG_AT.z;
    bat.D.add(rbox(2.3, 0.18, 2.3, 0.03), { p: [x, 0.09, z], color: 0x565a60 });
    bat.P.add(rbox(1.4, 0.06, 1.4, 0.02), { p: [x, 0.21, z], color: 0xdcdfe1 });
    bat.M.add(GM.Cylinder(0.38, 0.38, 1.7, 24), { p: [x, 1.1, z], color: 0x5a6068 });
    for (let i = 0; i < 17; i++) bat.M.add(GM.Cylinder(0.64, 0.64, 0.026, 30), { p: [x, 0.52 + i * 0.085, z], color: i % 4 === 0 ? 0x7c828a : 0x4d535b });
    bat.F.add(GM.Cylinder(0.44, 0.44, 0.3, 24, 1, true), { p: [x, 0.38, z], uv: 0, uvS: [1.4, 0.4] });
    bat.P.add(GM.Sphere(0.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), { p: [x, 1.95, z], color: 0xcfd3d6 });
    bat.M.add(GM.Cylinder(0.1, 0.1, 0.36, 12), { p: [x, 2.4, z], color: 0xb4bac0 });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; bat.M.add(strut([x + Math.sin(a) * 0.95, 0.2, z + Math.cos(a) * 0.95], [x + Math.sin(a) * 0.4, 0.62, z + Math.cos(a) * 0.4], 0.04), { uv: 0, color: 0x9aa0a6 }); }
    B.sign(new THREE.PlaneGeometry(0.62, 0.62), 'rad', { p: [x + 1.2, 1.4, z + 2.3], r: [0, -0.35, 0], uv: 0 });
    bat.M.add(GM.Cylinder(0.03, 0.03, 1.1, 6), { p: [x + 1.2, 0.55, z + 2.3 - 0.03], color: 0xaab0b6 });
    const post = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; post.push([x + Math.sin(a) * 2.3, z + Math.cos(a) * 2.3]); }
    post.forEach((q, i) => {
      bat.H.add(GM.Cylinder(0.075, 0.075, 0.9, 12), { p: [q[0], 0.45, q[1]], uv: 0, uvS: [3, 3] });
      bat.P.add(GM.Cylinder(0.085, 0.085, 0.05, 12), { p: [q[0], 0.92, q[1]], color: 0xe8b21a });
      const n = post[(i + 1) % post.length];
      bat.M.add(tubeGeo([[q[0], 0.8, q[1]], [(q[0] + n[0]) / 2, 0.62, (q[1] + n[1]) / 2], [n[0], 0.8, n[1]]], 0.012, 5, 10), { uv: 0, color: 0x2a2d32 });
    });
    colliders.push(kit.cyl(fr.wx(x, z), fr.wz(x, z), 1.15, fr.y0, fr.y0 + 2.7));
  }

  // ── lattice mast with the slot beacon + guy wires ──
  let beacon;
  {
    const x = MAST_AT.x, z = MAST_AT.z, H = 13.0, legs = [0, 1, 2].map((i) => { const a = i * Math.PI * 2 / 3 + 0.5; return [Math.sin(a), Math.cos(a)]; });
    const lp = (i, y) => { const k = 0.62 - 0.4 * (y / H); return [x + legs[i][0] * k, y, z + legs[i][1] * k]; };
    bat.D.add(rbox(2.0, 0.3, 2.0, 0.04), { p: [x, 0.05, z], color: 0x777b81 });
    for (let i = 0; i < 3; i++) bat.M.add(strut(lp(i, 0.2), lp(i, H), 0.045, 0.03), { uv: 0, color: 0xe4e6e8 });
    for (let y = 0.2; y < H - 0.5; y += 1.3) for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      bat.M.add(strut(lp(i, y), lp(j, y), 0.018), { uv: 0, color: 0xdfe2e5 });
      bat.M.add(strut(lp(i, y), lp(j, y + 1.3), 0.014), { uv: 0, color: 0xcfd3d6 });
    }
    for (let i = 0; i < 3; i++) for (const y of [5.5, 9.5]) bat.P.add(box(0.05, 0.9, 0.05), { p: [x + legs[i][0] * 0.9, y, z + legs[i][1] * 0.9], r: [0, 0, 0], color: 0xdadddf });
    bat.P.add(rbox(0.7, 0.55, 0.45, 0.04), { p: [x + 0.6, 7.2, z], color: 0xdadddf });
    bat.M.add(GM.Cylinder(0.02, 0.02, 2.2, 6), { p: [x, H + 1.0, z], color: 0xc4cad0 });
    bat.M.add(strut([x - 0.5, H - 1.5, z], [x - 1.6, H - 0.2, z + 0.6], 0.015), { uv: 0, color: 0xc4cad0 });
    B.sign(new THREE.PlaneGeometry(0.62, 0.26), 'rf', { p: [x + 0.2, 1.9, z + 0.58], r: [0, 0.3, 0], uv: 0 });
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + 1.9, ax_ = x + Math.sin(a) * 5.6, az_ = z + Math.cos(a) * 5.6, gy = env.groundY(fr.wx(ax_, az_), fr.wz(ax_, az_)) - fr.y0;
      bat.M.add(strut([x + legs[i][0] * 0.3, 9.0, z + legs[i][1] * 0.3], [ax_, gy + 0.1, az_], 0.011), { uv: 0, color: 0x2a2d32 });
      bat.D.add(box(0.5, 0.3, 0.5), { p: [ax_, gy + 0.1, az_], color: 0x70747a });
    }
    colliders.push(...[0, 1, 2].map((i) => kit.cyl(fr.wx(lp(i, 0)[0], lp(i, 0)[2]), fr.wz(lp(i, 0)[0], lp(i, 0)[2]), 0.28, fr.y0, fr.y0 + 4)));
    beacon = kit.beacon(fr.pos(x, H + 2.25, z).toArray(), { color: 0xff5428, size: 0.13, range: 44, lightI: 26, period: 2.7, duty: 0.11 });
    group.add(beacon.group);
  }

  // ── comms dish on a pedestal (animated head) ──
  let dishHead;
  {
    const x = DISH_AT.x, z = DISH_AT.z;
    bat.P.add(GM.Cylinder(1.0, 1.1, 0.32, 24), { p: [x, 0.08, z], color: 0x84888e, dirt: 0.2 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; bat.M.add(GM.Cylinder(0.05, 0.05, 0.05, 8), { p: [x + Math.sin(a) * 0.82, 0.27, z + Math.cos(a) * 0.82], color: 0xa4aab0 }); }
    bat.P.add(GM.Cylinder(0.36, 0.42, 1.95, 18), { p: [x, 1.2, z], color: 0xe2e4e6, dirt: 0.3 });
    bat.H.add(GM.Cylinder(0.43, 0.43, 0.3, 18, 1, true), { p: [x, 0.55, z], uv: 0, uvS: [6, 1] });
    bat.M.add(GM.Cylinder(0.46, 0.46, 0.12, 20), { p: [x, 2.2, z], color: 0xaab0b6 });
    B.sign(new THREE.PlaneGeometry(0.42, 0.2), 'rf', { p: [x + 0.2, 1.1, z + 0.4], r: [0, 0.45, 0], uv: 0 });
    colliders.push(kit.cyl(fr.wx(x, z), fr.wz(x, z), 1.0, fr.y0, fr.y0 + 2.4));
    // head: yaw group → pitch group
    const hb = makeBatch(identityFrame(env)), hm = makeBatch(identityFrame(env));
    const f = 1.1, Rd = 2.05, pr = []; for (let i = 0; i <= 20; i++) { const r = Rd * i / 20; pr.push([r, r * r / (4 * f)]); }
    const refl = lathe(pr, 44); { const a = refl.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * 8, a.getY(i) * 1.5); }
    const dep = Rd * Rd / (4 * f);
    hb.add(GM.Torus(Rd, 0.045, 6, 44), { p: [0, dep, 0], r: [Math.PI / 2, 0, 0], color: 0xdadddf, uv: 0.5 });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; hb.add(strut([Math.sin(a) * Rd * 0.97, dep, Math.cos(a) * Rd * 0.97], [0, f + 0.02, 0], 0.025), { uv: 0.5, color: 0xdfe2e5 }); }
    hb.add(GM.Cylinder(0.1, 0.16, 0.34, 14), { p: [0, f + 0.14, 0], color: 0x2c3036, uv: 0.5 });
    hb.add(GM.Cylinder(0.17, 0.17, 0.05, 14), { p: [0, f - 0.06, 0], color: 0xe36a14, uv: 0.5 });
    hb.add(GM.Cylinder(0.35, 0.5, 0.45, 18), { p: [0, -0.18, 0], color: 0xd4d8db, uv: 0.5 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; hb.add(strut([Math.sin(a) * 0.4, -0.05, Math.cos(a) * 0.4], [Math.sin(a) * Rd * 0.94, dep - 0.06, Math.cos(a) * Rd * 0.94], 0.028), { uv: 0.5, color: 0xaab0b6 }); }
    hm.add(rbox(0.22, 0.9, 0.5, 0.04), { p: [-0.5, -0.3, 0], color: 0xdadddf, uv: 0.5 });
    hm.add(rbox(0.22, 0.9, 0.5, 0.04), { p: [0.5, -0.3, 0], color: 0xdadddf, uv: 0.5 });
    const reflMesh = new THREE.Mesh(refl, mat.dish); reflMesh.castShadow = reflMesh.receiveShadow = true;
    const pitch = new THREE.Group(); pitch.add(reflMesh, hb.build(mat.metal));
    pitch.rotation.x = Math.PI / 2 - 0.62;
    const yokeMesh = hm.build(mat.metal);
    dishHead = new THREE.Group(); dishHead.add(pitch, yokeMesh);
    fr.place(dishHead, x, 2.3, z, 0.4); group.add(dishHead);
    updaters.push((dt, t) => { dishHead.rotation.y = fr.yaw + 0.4 + 0.5 * Math.sin(t * 0.021) + 0.12 * Math.sin(t * 0.17); pitch.rotation.x = Math.PI / 2 - (0.62 + 0.05 * Math.sin(t * 0.033)); });
  }

  // ── cable trenches, protectors, tracks, boot prints ──
  const trenchMat = S({ map: trenchTexture(kit), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const trenchParts = [];
  const trench = (pts, w, lift) => { const g = ribbon(fr, pts, w, { lift, step: 0.8, uLen: 3.2 }); trenchParts.push(g); };
  trench([[RTG_AT.x + 1.1, RTG_AT.z + 0.4], [-14.5, -9.4], [-11.4, -9.2]], 0.7, 0.04);
  trench([[SOLAR_AT.x + 1.5, SOLAR_AT.z - 1.6], [-10.2, 1.6], [-8.2, 1.1]], 0.7, 0.04);
  trench([[-8.2, 1.1], [-3.5, 0.9], [2.5, 0.35], [5.4, -0.55], [5.6, -1.35]], 0.55, 0.125);
  trench([[KIOSK.x - 0.9, KIOSK.z - 0.3], [KIOSK.x - 0.9, -1.3]], 0.5, 0.125);
  trench([[MAST_AT.x, MAST_AT.z + 0.9], [MAST_AT.x - 0.2, ANNEX.z - 2.8]], 0.55, 0.04);
  trench([[DISH_AT.x - 0.9, DISH_AT.z + 0.1], [19.0, -0.5], [ANNEX.x + 6.3, -0.4]], 0.5, 0.04);
  const trMesh = new THREE.Mesh(mergeAll(trenchParts), trenchMat); trMesh.receiveShadow = true; group.add(trMesh);
  for (const [lx, lz, ry] of [[-4.2, 0.78, -0.07], [2.0, 0.3, -0.12], [KIOSK.x - 0.9, 0.9, Math.PI / 2], [-9.6, 1.35, -0.28]]) {
    bat.H.add(box(1.5, 0.07, 0.62), { p: [lx, 0.15, lz], r: [0, ry, 0], uv: 0, uvS: [0.7, 1] });
    for (const s of [-1, 1]) bat.H.add(box(0.36, 0.045, 0.62), { p: [lx + Math.cos(ry) * s * 0.9, 0.14, lz - Math.sin(ry) * s * 0.9], r: [0, ry, s * 0.16], uv: 0, uvS: [0.3, 1] });
  }
  const decalMat = (map) => S({ map, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  {
    const tg = [ribbon(fr, [[4.2, 24], [5.6, 16], [3.6, 9.5], [1.4, 6.6]], 0.46, { lift: 0.03, step: 0.8, uLen: 1.1 }), ribbon(fr, [[5.9, 24], [7.3, 16], [5.3, 9.5], [3.1, 6.6]], 0.46, { lift: 0.03, step: 0.8, uLen: 1.1 })];
    const m = new THREE.Mesh(mergeAll(tg), decalMat(tracksTexture(kit))); m.receiveShadow = true; group.add(m);
    const bg = [groundPatch(fr, 13.4, 0.6, 4.6, 4.6, 0.2, 10, 10, 0.135), groundPatch(fr, -4.5, 1.9, 4.2, 4.2, -0.4, 10, 10, 0.135), groundPatch(fr, KIOSK.x + 0.3, KIOSK.z + 2.4, 3.6, 3.6, 0.5, 10, 10, 0.135)];
    const bm = new THREE.Mesh(mergeAll(bg), decalMat(bootsTexture(kit))); bm.receiveShadow = true; group.add(bm);
  }

  // ── rubble / boulders (angular ice-rock) around the pad rim and at the foundations ──
  {
    const blocked = (x, z) => (Math.hypot(x - DOME_AT.x, z - DOME_AT.z) < 8.4) || (x > -7.5 && x < 24 && z > -8.6 && z < 7.4 && !(x > 15 && z < -8.6)) || (Math.hypot(x - SOLAR_AT.x, z - SOLAR_AT.z) < 8.5) || (Math.hypot(x - RTG_AT.x, z - RTG_AT.z) < 3.8) || (Math.hypot(x - DISH_AT.x, z - DISH_AT.z) < 3.4) || (Math.hypot(x - MAST_AT.x, z - MAST_AT.z) < 6.6) || (x > -2 && x < 9 && z > 5 && z < 26);
    const cols = [0x8d8981, 0x9a968d, 0x7b7974, 0xa9b4be, 0xbcc6cf, 0x86837d];
    for (let i = 0, n = 0; i < 900 && n < 84; i++) {
      const a = rng() * Math.PI * 2, r = 9 + rng() * 14.5, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (blocked(x, z) || Math.hypot(x, z) > 23.6) continue;
      const s = 0.14 + Math.pow(rng(), 2.6) * 0.78, gy = fr.gy(x, z) - fr.y0;
      bat.R.add(rockGeo(n * 7 + 3, s * (0.9 + rng() * 0.6), s * (0.5 + rng() * 0.45), s * (0.8 + rng() * 0.5), { detail: s < 0.3 ? 0 : 1, rough: 0.34 }), { p: [x, gy + s * 0.12, z], r: [rng() * 0.4, rng() * 6.28, rng() * 0.4], color: cols[(rng() * cols.length) | 0], uv: 0, vcol: true });
      if (s > 0.6) colliders.push(kit.cyl(fr.wx(x, z), fr.wz(x, z), s * 0.85, fr.y0 - 0.5, fr.y0 + s));
      n++;
    }
    for (let i = 0; i < 26; i++) {   // loose rubble hugging the dome foundation and corridor
      const a = i / 26 * Math.PI * 2 + rng() * 0.2, r = 6.8 + rng() * 0.7, x = DOME_AT.x + Math.sin(a) * r, z = DOME_AT.z + Math.cos(a) * r;
      if (Math.cos(a) > 0.55 && Math.abs(Math.sin(a)) < 0.5) continue;
      const s = 0.12 + rng() * 0.28, gy = fr.gy(x, z) - fr.y0;
      bat.R.add(rockGeo(100 + i, s * 1.2, s * 0.7, s, { detail: 0 }), { p: [x, gy + s * 0.1, z], r: [0, rng() * 6.28, 0], color: cols[(rng() * cols.length) | 0], uv: 0, vcol: true });
    }
  }

  // ── flush batches into meshes ──
  const meshes = [bat.P.build(mat.paint), bat.M.build(mat.metal), bat.D.build(mat.dark), bat.F.build(mat.foil), bat.G.build(mat.glow, { cast: false, receive: false }), bat.H.build(mat.haz), bat.SIGN.build(mat.sign), bat.RAD.build(mat.rad), bat.SOL.build(mat.solar), bat.R.build(mat.rock)];
  for (const m of meshes) if (m) group.add(m);

  // ── interactables ──
  const interactables = [
    kit.interactable({ id: 'poi.world.charon.poi.telescope', label: 'Inspect the Sentinel telescope', pos: dome.door, radius: 3.6, object: dome.dome, lineId: 'world.charon.poi.telescope' }),
    kit.interactable({ id: 'poi.world.charon.poi.ghost', label: 'Study the long exposure', pos: annex.screenPos, radius: 3.4, object: annex.screen, lineId: 'world.charon.poi.ghost' }),
    kit.interactable({ id: 'log.charon.1', label: 'Play field recorder', pos: annex.recorderPos, radius: 2.7, object: annex.rec, lineId: 'log.charon.1', log: true }),
  ];

  return {
    group, interactables, colliders,
    update(dt, t, camPos) { beacon.update(t); for (const u of updaters) u(dt, t, camPos); },
  };
}
