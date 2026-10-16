// ORPHEUS · Phlegethon · Cinder Ridge — seismic / volcano-monitoring station straddling the lava river (slot `seismic`).
// Frame: "bridge-local" (u = lateral across the channel, y = world up, v = along the flow) → world by Mb; ground-standing
// camp items on the west bank are placed in world coordinates (axis-aligned so colliders stay exact).
import * as THREE from 'three';
import {
  Bucket, bevBox, box, tube, cylY, dishGeo, catenary, foilMats, solarTexture, plateTexture, hazardTexture,
  decalAtlas, decalGeo, stencil, label, wear, ashPatch, scaleUV, place, clamp, smooth, lerp, TAU,
} from './poi_phlegethon_kit.js';

const PAINT = 0xc9cdca, PAINT2 = 0xa9aeac, ORANGE = 0xd9601a, DARK = 0x24282c, CONC = 0x77736e, GALV = 0x8d949a, RUBBER = 0x15171a, OLIVE = 0x4d5538, YEL = 0xd8a416;
const GREEN = [0.35, 3.2, 1.1], AMBER = [4.2, 1.7, 0.2], CYAN = [0.4, 2.6, 3.4], REDL = [4.5, 0.25, 0.15];

/** fallback straight river through the slot (only used if env.features.river is missing) */
function straightRiver(slot) {
  return { wLava: 4.6, wChannel: 12.4, cx: () => slot.x, dcx: () => 0, dist: (x) => x - slot.x, flow: () => [0, 1] };
}
/** world AABB (collider) of a box footprint w×d rotated by yaw */
function aabb(cx, cz, w, d, yaw, y0, y1) {
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), hx = (c * w + s * d) / 2, hz = (s * w + c * d) / 2;
  return { min: [cx - hx, y0, cz - hz], max: [cx + hx, y1, cz + hz] };
}

export function buildSeismic(env) {
  const { kit } = env, slot = env.slots.seismic, river = env.features.river || straightRiver(slot);
  const group = new THREE.Group(); group.name = 'phlegethon-seismic';
  const colliders = [], interactables = [];

  // ───────────── frame: bridge-local (u across, v along flow) ─────────────
  const z0 = slot.z, Cx = river.cx(z0), [fx, fz] = river.flow(z0), ex = fz, ez = -fx, psi = Math.atan2(-ez, ex);
  const Wx = (u, v = 0) => Cx + u * ex + v * fx, Wz = (u, v = 0) => z0 + u * ez + v * fz;
  const gy = (u, v = 0) => env.groundY(Wx(u, v), Wz(u, v));
  const Mb = new THREE.Matrix4().makeRotationY(psi); Mb.setPosition(Cx, 0, z0);
  const W3 = (u, y, v) => new THREE.Vector3(Wx(u, v), y, Wz(u, v));
  const wCh = river.wChannel;
  const solveU = (target) => {
    let u = target;
    for (let i = 0; i < 8; i++) { const d0 = river.dist(Wx(u), Wz(u)), d1 = river.dist(Wx(u + 0.5), Wz(u + 0.5)), sl = (d1 - d0) / 0.5; if (Math.abs(sl) < 0.2) break; u += (target - d0) / sl; }
    return u;
  };
  const uW = solveU(-(wCh + 2.6)), uE = solveU(wCh + 2.6), uc = (uW + uE) / 2;
  const lavaY = env.groundY(Cx, z0);
  let spanMax = -1e9; for (let u = uW; u <= uE; u += 1) spanMax = Math.max(spanMax, gy(u));
  const gW = gy(uW), gE = gy(uE);
  const bankMax = Math.max(gW, gE);
  // deck 6.2–7 m above the lava (brief: 5–7 m) but never lower than head-clear (2.2 m) above the bank ends / 1.7 m above the span ground
  const deckY = Math.max(Math.min(Math.max(lavaY + 6.2, bankMax + 2.5), lavaY + 7.0), bankMax + 2.5, spanMax + 1.7);
  const uA = uW - 0.9, uB = uE + 0.9, nB = Math.max(8, Math.round((uB - uA) / 2.5)), du = (uB - uA) / nB, U = (i) => uA + i * du;
  const vT = 1.2, yTop = deckY + 1.15, yBot = deckY - 0.14, yTower = deckY + 3.6, yU = deckY - 0.32;

  // ───────────── textures + materials ─────────────
  const plateTex = plateTexture(4), hazTex = hazardTexture(), solarTex = solarTexture(6, 6);
  const panelTex = kit.panelTexture({ base: '#d3d6d4', w: 256, h: 256, cols: 4, rows: 4, seed: 12, grimeAmt: 1.0 });
  const asha = (m, amount = 0.55, o = {}) => ashPatch(m, { amount, groundY: Math.min(gW, gE), low: 1.5, ...o });
  const mMatte = asha(kit.std({ vertexColors: true, roughness: 0.62, metalness: 0.08 }), 0.5);
  const mSteel = asha(kit.std({ vertexColors: true, roughness: 0.48, metalness: 0.6 }), 0.4);
  const mDish = asha(kit.std({ vertexColors: true, roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide }), 0.45);
  const mDeck = asha(kit.std({ map: plateTex, vertexColors: true, roughness: 0.55, metalness: 0.4 }), 0.55);
  const mHaz = asha(kit.std({ map: hazTex, vertexColors: true, roughness: 0.6, metalness: 0.05 }), 0.35);
  const mPanel = asha(kit.std({ map: panelTex, vertexColors: true, roughness: 0.62, metalness: 0.1 }), 0.6);
  const mSolar = asha(kit.std({ map: solarTex, vertexColors: true, roughness: 0.22, metalness: 0.5, emissive: 0xff5a14, emissiveIntensity: 0.07 }), 0.45);
  const foilM = foilMats(kit, 5), mFoilG = foilM.gold, mFoilS = foilM.silver;
  const mGlass = kit.std({ vertexColors: true, color: 0x0a1218, roughness: 0.06, metalness: 0.7 });
  const mLed = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
  const warnMatA = kit.glow(0xffa030, 7, { vertexColors: true }), warnMatB = kit.glow(0xffa030, 7, { vertexColors: true });

  // seismograph trace screen (scrolls)
  const traceTex = kit.canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#04141a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,160,170,0.22)'; g.lineWidth = 1;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); g.stroke(); }
    for (let y = 8; y < h; y += 16) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); }
    const trace = (y0, amp, seed, col) => {
      g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath();
      for (let x = 0; x <= w; x++) {
        const bx = 60 + seed * 70, burst = Math.exp(-((x - bx) ** 2) / 260) + Math.exp(-((x - bx - w) ** 2) / 260) + Math.exp(-((x - bx + w) ** 2) / 260);
        const y = y0 + (Math.sin(x * TAU / w * 7 + seed) * 0.12 + Math.sin(x * TAU / w * 23 + seed * 2) * 0.1 + Math.sin(x * TAU / w * 61 + seed * 3) * burst * 0.9) * amp;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    };
    trace(16, 11, 1, '#6bf0ff'); trace(32, 11, 2, '#8cffb0'); trace(48, 11, 3, '#ffb35c');
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < h; y += 2) g.fillRect(0, y, w, 1);
  }, { aniso: 4 });
  const mScreen = kit.screen(traceTex, 1.5, { vertexColors: false });

  // decal atlas (signs, stencils, labels) — text auto-fits its cell
  const grimeOn = (g, w, h, a = 0.5, s = 4) => kit.grime(g, w, h, { amount: a, color: 'rgba(30,22,14,0.22)', streaks: 4, seed: s });
  const atlas = decalAtlas(512, 512, {
    danger: { x: 4, y: 4, w: 256, h: 180, draw: (g, w, h) => {
      g.fillStyle = '#e6e1d2'; g.fillRect(0, 0, w, h); g.fillStyle = '#b3261a'; g.fillRect(0, 0, w, 58);
      label(g, 'DANGER', w / 2, 31, w - 40, 44, '#fff'); label(g, 'MOLTEN ROCK', w / 2, 90, w - 30, 36, '#16181b');
      label(g, 'KEEP BACK 15 m FROM CHANNEL', w / 2, 128, w - 24, 20, '#16181b', 700); label(g, 'NO PERSONNEL ON SPAN', w / 2, 154, w - 24, 20, '#16181b', 700);
      g.strokeStyle = '#16181b'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, w - 5, h - 5); grimeOn(g, w, h, 0.5, 4);
    } },
    station: { x: 264, y: 4, w: 244, h: 100, draw: (g, w, h) => {
      g.fillStyle = '#1c2125'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9601a'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
      label(g, 'SEISMIC STATION CS-4', w / 2, 33, w - 28, 30, '#eef1f2'); label(g, 'HALCYON SURVEY · VOLCANO MONITORING', w / 2, 64, w - 28, 17, '#e8742c', 700);
      label(g, 'CINDER RIDGE · PHLEGETHON', w / 2, 85, w - 28, 13, '#9aa4a8', 600); grimeOn(g, w, h, 0.4, 7);
    } },
    hut: { x: 264, y: 110, w: 244, h: 72, draw: (g, w, h) => {
      stencil(g, 'INSTRUMENT HUT', w / 2, 24, 34, '#2c3238', { spacing: 1.5, maxW: w - 16 }); stencil(g, 'AUTHORISED PERSONNEL ONLY', w / 2, 56, 15, '#2c3238', { spacing: 0.5, maxW: w - 16 }); wear(g, w, h, 0.45, 9);
    } },
    cs4: { x: 4, y: 190, w: 160, h: 90, draw: (g, w, h) => { stencil(g, 'CS-4', w / 2, h / 2, 74, '#2c3238', { spacing: 2, maxW: w - 16 }); wear(g, w, h, 0.5, 11); } },
    batt: { x: 170, y: 190, w: 130, h: 80, draw: (g, w, h) => {
      g.fillStyle = '#d8a416'; g.fillRect(0, 0, w, h); g.fillStyle = '#16181b'; g.fillRect(4, 4, w - 8, 20);
      label(g, 'BATTERY', w / 2, 14, w - 24, 17, '#d8a416');
      g.fillStyle = '#16181b'; g.beginPath(); g.moveTo(w * 0.52, 30); g.lineTo(w * 0.36, 56); g.lineTo(w * 0.47, 56); g.lineTo(w * 0.42, 76); g.lineTo(w * 0.64, 48); g.lineTo(w * 0.52, 48); g.closePath(); g.fill();
      label(g, '48 V · 2.4 kWh', w * 0.76, 62, 56, 12, '#16181b', 700); grimeOn(g, w, h, 0.7, 13);
    } },
    hot: { x: 306, y: 190, w: 110, h: 90, draw: (g, w, h) => {
      g.fillStyle = '#e6c21a'; g.beginPath(); g.moveTo(w / 2, 4); g.lineTo(w - 6, h - 6); g.lineTo(6, h - 6); g.closePath(); g.fill();
      g.strokeStyle = '#16181b'; g.lineWidth = 5; g.stroke(); g.lineWidth = 3.4; g.lineCap = 'round';
      for (const x of [w * 0.36, w * 0.5, w * 0.64]) { g.beginPath(); g.moveTo(x, h - 20); g.bezierCurveTo(x - 7, h - 34, x + 7, h - 46, x, h - 58); g.stroke(); }
      grimeOn(g, w, h, 0.5, 15);
    } },
  });
  const mDecal = asha(kit.std({ map: atlas.tex, vertexColors: true, transparent: true, roughness: 0.7, metalness: 0.02, depthWrite: false, alphaTest: 0.02 }), 0.25);

  // ───────────── buckets ─────────────
  const matte = new Bucket(21, 0.05), steel = new Bucket(22, 0.05), deck = new Bucket(23, 0), haz = new Bucket(24, 0), panel = new Bucket(25, 0.03), dish = new Bucket(26, 0.02);
  const solar = new Bucket(27, 0.04), foilG = new Bucket(28, 0), foilS = new Bucket(29, 0), glass = new Bucket(30, 0), led = new Bucket(31, 0), decals = new Bucket(32, 0);
  const warnA = new Bucket(33, 0), warnB = new Bucket(34, 0), screens = new Bucket(35, 0);
  const sub = (g, off, pos, rot) => place(place(g, off, null), pos, rot);   // two-level transform (part offset, then rig placement)
  const worldCable = (b, pts, r, color, radial = 4) => { for (let i = 0; i < pts.length - 1; i++) b.raw(tube(pts[i], pts[i + 1], r, r, radial), color, true); };

  // ───────────── truss bridge ─────────────
  for (const s of [-1, 1]) {
    matte.beam([uA, yTop, s * vT], [uB, yTop, s * vT], 0.17, 0.15, PAINT);
    matte.beam([uA, yBot, s * vT], [uB, yBot, s * vT], 0.17, 0.2, PAINT2);
    steel.beam([uA, deckY + 0.62, s * (vT + 0.02)], [uB, deckY + 0.62, s * (vT + 0.02)], 0.05, 0.05, GALV);
    for (let i = 0; i <= nB; i++) {
      matte.beam([U(i), yBot, s * vT], [U(i), yTop, s * vT], 0.1, 0.1, PAINT);
      for (const yy of [yBot, yTop]) matte.raw(place(box(0.3, 0.26, 0.035, 0.5), [U(i), yy + (yy > deckY ? -0.1 : 0.02), s * (vT + 0.075)]), PAINT2);
    }
    for (let i = 0; i < nB; i++) { const up = i % 2 === 0; matte.beam([U(i), up ? yBot : yTop, s * vT], [U(i + 1), up ? yTop : yBot, s * vT], 0.08, 0.08, ORANGE); }
  }
  for (let i = 0; i <= nB; i++) {
    steel.beam([U(i), yBot - 0.06, -1.4], [U(i), yBot - 0.06, 1.4], 0.12, 0.2, DARK);
    if (i < nB) {
      matte.beam([U(i), yBot - 0.2, -1.15], [U(i + 1), yBot - 0.2, 1.15], 0.05, 0.05, PAINT2);
      matte.beam([U(i), yBot - 0.2, 1.15], [U(i + 1), yBot - 0.2, -1.15], 0.05, 0.05, PAINT2);
    }
    if (i % 4 === 0 || i === nB) matte.beam([U(i), yTop, -vT], [U(i), yTop, vT], 0.09, 0.09, PAINT);
  }
  for (const v of [-0.7, 0, 0.7]) matte.beam([uA, yBot - 0.02, v], [uB, yBot - 0.02, v], 0.08, 0.14, DARK);
  deck.add(box(uB - uA, 0.07, 2.62, 0.6), [(uA + uB) / 2, deckY - 0.035, 0], null, 0xffffff);
  for (const s of [-1, 1]) haz.add(box(uB - uA, 0.15, 0.06, 0.64), [(uA + uB) / 2, deckY + 0.075, s * 1.1], null, 0xffffff);
  for (const [u, k] of [[uA, 0], [uB, nB]]) {
    matte.beam([u, yTop - 0.02, -vT], [u, yTop - 0.02, vT], 0.14, 0.14, PAINT);
    for (const s of [-1, 1]) {
      matte.beam([u, yTop - 0.9, s * vT], [u + (k === 0 ? 0.9 : -0.9), yTop, s * vT], 0.07, 0.07, ORANGE);
      haz.add(box(0.14, 1.0, 0.14, 0.5), [u, deckY + 0.5, s * vT], null, 0xffffff);
    }
  }

  // ───────────── A-frame abutment towers + stays ─────────────
  const towers = [{ u: uW, dir: -1 }, { u: uE, dir: 1 }], towerLegs = [];
  for (const T of towers) {
    const baseV = 2.35, topV = 0.95, legs = [-1, 1].map((s) => ({ s, y: gy(T.u, s * baseV) }));
    const yb = (legs[0].y + legs[1].y) / 2, vAt = (y) => lerp(baseV, topV, clamp((y - yb) / (yTower - yb)));
    for (const L of legs) {
      steel.tube([T.u, L.y + 0.06, L.s * baseV], [T.u, yTower, L.s * topV], 0.2, 0.14, 12, 0xb9bfc2);
      haz.raw(scaleUV(tube([T.u, L.y + 0.3, L.s * (baseV - 0.04)], [T.u, L.y + 1.5, L.s * (baseV - 0.12)], 0.215, 0.208, 14), 3, 1.6), 0xffffff);
      matte.raw(place(bevBox(1.1, 0.55, 1.1, 0.06, 1.0), [T.u, L.y - 0.02, L.s * baseV]), CONC);
      steel.raw(place(box(0.62, 0.05, 0.62, 1), [T.u, L.y + 0.275, L.s * baseV]), 0x6c7378);
      for (const [bx, bz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) steel.raw(place(cylY(0.03, 0.03, 0.1, 6), [T.u + bx * 0.22, L.y + 0.3, L.s * baseV + bz * 0.22]), GALV);
      towerLegs.push({ x: Wx(T.u, L.s * baseV), z: Wz(T.u, L.s * baseV), y: L.y });
    }
    const yG = deckY - 0.34, yM = deckY + 1.9, vG = vAt(yG), vM = vAt(yM);
    steel.beam([T.u, yG, -vG - 0.1], [T.u, yG, vG + 0.1], 0.24, 0.34, DARK);
    matte.beam([T.u, yM, -vM], [T.u, yM, vM], 0.12, 0.14, PAINT);
    matte.beam([T.u, yTower, -topV - 0.15], [T.u, yTower, topV + 0.15], 0.2, 0.18, PAINT);
    matte.beam([T.u, yG + 0.15, -vG], [T.u, yM, vM], 0.07, 0.07, ORANGE); matte.beam([T.u, yG + 0.15, vG], [T.u, yM, -vM], 0.07, 0.07, ORANGE);
    // station plate on the tower, facing the approach side
    matte.raw(place(bevBox(0.05, 0.66, 1.5, 0.015, 1), [T.u + T.dir * 0.02, yM - 0.55, 0]), 0x1c2125);
    decals.add(decalGeo(atlas.rects.station, 1.44, 0.59), [T.u + T.dir * 0.05, yM - 0.55, 0], [0, T.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0], 0xffffff);
    for (const s of [-1, 1]) {
      for (let k = 1; k <= 3; k++) { const i = clamp(Math.round((T.u - T.dir * 3 * k - uA) / du), 1, nB - 1); steel.tube([T.u, yTower - 0.05, s * topV], [U(i), yTop, s * vT], 0.024, 0.024, 5, 0x9aa1a6); }
      const ax = T.u + T.dir * 7.6, ay = gy(ax, s * 2.2) + 0.2;
      steel.tube([T.u, yTower - 0.05, s * topV], [ax, ay, s * 2.2], 0.03, 0.03, 5, 0x9aa1a6);
      matte.raw(place(bevBox(0.7, 0.45, 0.7, 0.05, 1.0), [ax, ay - 0.2, s * 2.2]), CONC);
      steel.raw(place(new THREE.TorusGeometry(0.1, 0.02, 6, 12), [ax, ay + 0.1, s * 2.2], [Math.PI / 2, 0, 0]), GALV);
      // warning strobes on the tower cap
      (s > 0 === T.dir > 0 ? warnA : warnB).raw(place(new THREE.SphereGeometry(0.1, 10, 8), [T.u, yTower + 0.2, s * (topV + 0.15)]), 0xffffff);
      steel.raw(place(cylY(0.07, 0.06, 0.1, 8), [T.u, yTower + 0.09, s * (topV + 0.15)]), 0x30363b);
    }
  }
  // truss-corner strobes
  for (const [u, k] of [[uA, 0], [uB, nB]]) for (const s of [-1, 1]) {
    (k === 0 ? (s > 0 ? warnA : warnB) : (s > 0 ? warnB : warnA)).raw(place(new THREE.SphereGeometry(0.085, 10, 8), [u, yTop + 0.18, s * vT]), 0xffffff);
    steel.raw(place(cylY(0.06, 0.05, 0.08, 8), [u, yTop + 0.08, s * vT]), 0x30363b);
  }

  // ───────────── caged ladder at the west end ─────────────
  { const lu = uA - 0.16, g0 = gy(lu, 0), top = deckY + 1.0;
    for (const s of [-1, 1]) steel.tube([lu, g0 + 0.05, s * 0.27], [lu, top, s * 0.27], 0.022, 0.022, 6, GALV);
    for (let y = g0 + 0.35; y < top - 0.1; y += 0.3) steel.tube([lu, y, -0.27], [lu, y, 0.27], 0.014, 0.014, 5, GALV);
    haz.add(box(0.04, 0.28, 0.6, 0.3), [lu - 0.06, deckY + 0.2, 0], null, 0xffffff);
  }

  // ───────────── instrument pods under the deck ─────────────
  const hangers = (u, yTopPod, hw, hd, rod = 0.028) => { for (const a of [-1, 1]) for (const b of [-1, 1]) steel.tube([u + a * hw, yTopPod, b * hd], [u + a * hw * 0.8, yU + 0.04, b * hd * 0.9], rod, rod, 6, GALV); };
  const ledAt = (pos, rgb, s = 0.045) => led.raw(place(new THREE.BoxGeometry(s, s, s * 0.6), pos), rgb);
  // A — silver MLI electronics box
  { const u = uc - 5.6, y = yU - 1.0;
    foilS.raw(place(bevBox(1.3, 0.8, 0.9, 0.07, 1.2), [u, y, 0]), 0xffffff);
    foilG.raw(place(bevBox(1.2, 0.04, 0.8, 0.02, 1.2), [u, y - 0.43, 0]), 0xffffff);
    hangers(u, y + 0.4, 0.5, 0.32); steel.tube([u + 0.4, y + 0.4, 0.2], [u + 0.45, y + 1.35, 0.35], 0.012, 0.012, 4, GALV);
    steel.raw(place(box(0.34, 0.2, 0.04, 1), [u, y + 0.1, 0.47]), 0x30363b); ledAt([u - 0.08, y + 0.1, 0.5], GREEN); ledAt([u + 0.0, y + 0.1, 0.5], AMBER); ledAt([u + 0.08, y + 0.1, 0.5], GREEN);
    for (const s of [-1, 1]) for (const b of [-1, 1]) steel.raw(place(cylY(0.022, 0.022, 0.03, 6), [u + s * 0.58, y + 0.38, b * 0.38]), GALV);
  }
  // B — gold MLI seismometer vault (horizontal cylinder) + gas-sampling snout
  { const u = uc - 0.4, y = yU - 1.12;
    foilG.raw(place(scaleUV(tube([u, y, -0.8], [u, y, 0.8], 0.44, 0.44, 22, false), 2.3, 1.4)), 0xffffff);
    for (const s of [-1, 1]) foilS.raw(place(tube([u, y, s * 0.82], [u, y, s * 0.8], 0.47, 0.47, 22, false)), 0xffffff);
    for (const s of [-1, 1]) for (const a of [-1, 1]) steel.tube([u + a * 0.3, y + 0.42, s * 0.55], [u + a * 0.26, yU + 0.04, s * 0.5], 0.028, 0.028, 6, GALV);
    steel.tube([u, y - 0.44, 0], [u, y - 1.35, 0], 0.04, 0.04, 8, GALV); steel.tube([u, y - 1.35, 0], [u, y - 1.62, 0], 0.03, 0.15, 12, 0x4a4f54);
    ledAt([u + 0.0, y + 0.1, 0.86], CYAN, 0.05); ledAt([u + 0.1, y + 0.1, 0.86], GREEN, 0.05);
    for (const s of [-1, 1]) matte.raw(place(bevBox(0.1, 0.06, 0.5, 0.02, 1), [u, y + 0.46, s * 0.55]), DARK);
  }
  // C — silver radiometer box with a downward lens
  { const u = uc + 4.6, y = yU - 0.95;
    foilS.raw(place(bevBox(0.95, 0.7, 0.8, 0.06, 1.2), [u, y, 0]), 0xffffff);
    hangers(u, y + 0.35, 0.38, 0.28);
    steel.tube([u, y - 0.35, 0], [u, y - 0.72, 0], 0.17, 0.2, 14, 0x2b3035);
    glass.raw(place(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 14), [u, y - 0.73, 0]), 0xffffff);
    foilG.raw(place(bevBox(0.5, 0.03, 0.5, 0.01, 1.2), [u, y - 0.44, 0]), 0xffffff);
    ledAt([u + 0.3, y + 0.12, 0.42], REDL, 0.04); ledAt([u + 0.38, y + 0.12, 0.42], GREEN, 0.04);
  }
  // trunk cable + festoons between pods and towers
  { const ys = yU + 0.05, a = [uc - 5.6, ys, 0.3], b = [uc - 0.4, ys, 0.3], c = [uc + 4.6, ys, 0.3];
    matte.cable([[uA + 0.2, ys, 0.3], [uc - 5.6, ys, 0.3]], 0.03, RUBBER, 5); matte.cable(catenary(a, b, 0.18, 8), 0.025, RUBBER, 5); matte.cable(catenary(b, c, 0.18, 8), 0.025, RUBBER, 5); matte.cable([c, [uB - 0.2, ys, 0.3]], 0.03, RUBBER, 5);
    matte.cable(catenary([uc - 5.6, yU - 0.55, 0.3], [uc - 0.4, yU - 0.7, 0.6], 0.3, 8), 0.02, YEL, 4);
  }
  // lava thermocouple lance on a winch under the deck
  { const u = uc + 2.2, yLo = lavaY + 1.9;
    foilG.raw(place(bevBox(0.55, 0.32, 0.42, 0.04, 1.2), [u, yU - 0.2, 0.55]), 0xffffff);
    steel.tube([u, yU - 0.36, 0.55], [u, yLo + 0.55, 0.55], 0.011, 0.011, 5, 0x30363b);
    foilG.raw(place(scaleUV(tube([u, yLo + 0.55, 0.55], [u, yLo, 0.55], 0.09, 0.055, 10, false), 1, 1)), 0xffffff);
    led.raw(place(new THREE.SphereGeometry(0.05, 10, 8), [u, yLo - 0.02, 0.55]), [6.0, 1.7, 0.3]);
  }
  // deck-mounted data boxes
  foilS.raw(place(bevBox(0.9, 0.56, 0.6, 0.05, 1.2), [uA + 1.6, deckY + 0.3, -0.55]), 0xffffff);
  foilG.raw(place(bevBox(0.8, 0.5, 0.6, 0.05, 1.2), [uB - 1.6, deckY + 0.27, 0.55]), 0xffffff);
  ledAt([uA + 1.2, deckY + 0.35, -0.24], GREEN, 0.04); ledAt([uB - 1.99, deckY + 0.32, 0.24], AMBER, 0.04);
  // cool-white work lamps under the deck
  for (const [u, v] of [[uA + 4.0, -1.0], [uc - 3.0, 1.0], [uc + 2.0, -1.05], [uB - 4.0, 1.0]]) {
    steel.raw(place(bevBox(0.3, 0.1, 0.2, 0.02, 1), [u, yU - 0.05, v]), 0x2f353a); led.raw(place(box(0.23, 0.016, 0.14, 1), [u, yU - 0.108, v]), [2.8, 3.1, 3.4]);
  }

  // ───────────── thermal camera on a pole ─────────────
  { const u = uc + 1.4, v = -1.0, hP = 3.4;
    steel.tube([u, deckY + 0.05, v], [u, deckY + hP, v], 0.06, 0.05, 10, 0xb9bfc2);
    steel.raw(place(cylY(0.16, 0.16, 0.04, 12), [u, deckY, v]), 0x6c7378);
    for (const du2 of [-2.4, 2.4]) steel.tube([u, deckY + 2.5, v], [u + du2, yTop, -vT], 0.014, 0.014, 4, 0x9aa1a6);
    const hp = [u, deckY + hP + 0.12, v], hr = [0.42, Math.PI, 0];
    steel.raw(sub(bevBox(0.2, 0.24, 0.2, 0.03, 1), [0, 0, 0], hp, [0, Math.PI, 0]), 0x3a4146);
    const cp = [u, deckY + hP + 0.38, v - 0.12];
    matte.raw(sub(bevBox(0.3, 0.26, 0.55, 0.05, 1), [0, 0, 0.0], cp, hr), 0xdcdfdc);
    matte.raw(sub(bevBox(0.34, 0.02, 0.62, 0.01, 1), [0, 0.17, 0.04], cp, hr), 0xeef0ee);
    steel.raw(sub(new THREE.CylinderGeometry(0.1, 0.11, 0.14, 14).rotateX(Math.PI / 2), [0, 0, 0.34], cp, hr), 0x2b3035);
    glass.raw(sub(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 14).rotateX(Math.PI / 2), [0, 0, 0.415], cp, hr), 0xffffff);
    led.raw(sub(new THREE.BoxGeometry(0.03, 0.03, 0.02), [0.1, 0.1, 0.28], cp, hr), REDL);
  }

  // ───────────── solar array on the east bank (faces the channel — catches the lava glow) ─────────────
  { const us = uE + 5.2, tilt = 0.62, pw = 1.5, pd = 1.0, y0 = gy(us, 0) + 0.5;
    for (let k = -2; k <= 2; k++) {
      const v = k * 1.58;
      solar.add(bevBox(pd, 0.05, pw, 0.012, 0.94), [us, y0 + 0.5 * Math.sin(tilt) * pd + 0.08, v], [0, 0, tilt], 0xffffff);
    }
    for (const s of [-1, 1]) {
      const vx = s * 3.3, gB = gy(us + 0.5, vx), gF = gy(us - 0.45, vx);
      steel.tube([us + 0.5, gB, vx], [us + 0.5, y0 + 0.95 + 0.08, vx], 0.04, 0.04, 8, GALV);
      steel.tube([us - 0.45, gF, vx], [us - 0.45, y0 + 0.08, vx], 0.04, 0.04, 8, GALV);
    }
    steel.beam([us - 0.43, y0 + 0.02, -3.9], [us - 0.43, y0 + 0.02, 3.9], 0.06, 0.06, GALV); steel.beam([us + 0.45, y0 + 0.95, -3.9], [us + 0.45, y0 + 0.95, 3.9], 0.06, 0.06, GALV);
    matte.raw(place(bevBox(0.4, 0.3, 0.26, 0.03, 1), [us + 0.7, gy(us + 0.7, 3.9) + 0.15, 3.9]), ORANGE); ledAt([us + 0.7, gy(us + 0.7, 3.9) + 0.22, 3.78], GREEN, 0.04);
  }

  // ───────────── geophone arrays + cables to the banks ─────────────
  { for (const [uEnd, dir] of [[uA + 0.4, -1], [uB - 0.4, 1]]) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const ug = uEnd + dir * (4.4 + 3.1 * k), vg = s * (2.6 + 2.1 * k), g = gy(ug, vg);
      const p0 = [uEnd, yU + 0.12, s * 1.36], p1 = [ug, g + 0.14, vg];
      matte.cable(catenary(p0, p1, 0.9 + 0.25 * k, 12), 0.021, RUBBER, 4);
      matte.raw(place(cylY(0.07, 0.07, 0.17, 8), [ug, g, vg]), 0x2d3236);
      matte.raw(place(cylY(0.075, 0.075, 0.035, 8), [ug, g + 0.1, vg]), YEL);
      steel.tube([ug, g - 0.2, vg], [ug, g, vg], 0.004, 0.02, 4, GALV);
      steel.tube([ug + 0.12, g, vg + 0.0], [ug + 0.12, g + 0.95, vg], 0.007, 0.007, 4, GALV);
      matte.raw(place(box(0.2, 0.13, 0.006, 1), [ug + 0.22, g + 0.88, vg]), ORANGE);
    }
  }

  // ───────────── danger sign by the west approach ─────────────
  { const su = uW - 3.4, sv = 3.7, g = gy(su, sv);
    steel.tube([su, g, sv], [su, g + 2.35, sv], 0.04, 0.04, 8, GALV);
    matte.raw(place(bevBox(0.03, 0.78, 1.1, 0.012, 1), [su - 0.015, g + 1.78, sv]), 0xd8d3c4);
    decals.add(decalGeo(atlas.rects.danger, 1.05, 0.738), [su - 0.04, g + 1.78, sv], [0, -Math.PI / 2, 0], 0xffffff);
    matte.raw(place(cylY(0.1, 0.12, 0.14, 8), [su, g, sv]), CONC);
  }

  // borehole seismometer vaults by the west tower (ground level, walkable approach)
  for (const [vu, vv] of [[uW - 2.7, 2.3], [uW - 4.0, -2.0]]) {
    const x = Wx(vu, vv), z = Wz(vu, vv), g = env.groundY(x, z);
    matte.raw(place(cylY(0.52, 0.5, 0.5, 20), [x, g - 0.12, z]), CONC, true);
    steel.raw(place(cylY(0.47, 0.47, 0.07, 20), [x, g + 0.38, z]), 0x9aa1a6, true);
    haz.raw(scaleUV(place(tube([x, g + 0.2, z], [x, g + 0.36, z], 0.525, 0.525, 20), null, null), 6, 0.3), 0xffffff, true);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; steel.raw(place(cylY(0.016, 0.016, 0.03, 6), [x + Math.cos(a) * 0.36, g + 0.45, z + Math.sin(a) * 0.36]), 0x5a6166, true); }
    steel.raw(place(new THREE.TorusGeometry(0.09, 0.014, 6, 12, Math.PI), [x, g + 0.5, z], [0, 0.4, 0]), 0xb9bfc2, true);
    led.raw(place(new THREE.BoxGeometry(0.04, 0.04, 0.02), [x + 0.28, g + 0.43, z + 0.18]), vv > 0 ? GREEN : AMBER, true);
    const tl = towerLegs[vv > 0 ? 1 : 0], pts = [[x + 0.45, g + 0.08, z], [x + 1.0, g + 0.045, z + 0.5]];
    for (let i = 1; i <= 8; i++) { const t = i / 8, px = lerp(x + 1.0, tl.x - 0.7, t), pz = lerp(z + 0.5, tl.z, t) + Math.sin(t * 6) * 0.25; pts.push([px, env.groundY(px, pz) + 0.045, pz]); }
    worldCable(matte, pts, 0.032, RUBBER, 5);
    colliders.push(kit.cyl(x, z, 0.58, g - 0.3, g + 0.6));
  }

  // ───────────── west-bank camp (world space) ─────────────
  const hx = Wx(uW - 9.6, -7.2), hz = Wz(uW - 9.6, -7.2), HW = 3.6, HD = 2.5, HH = 2.45, ht = 0.12;
  const fp = kit.footprint(hx, hz, HW / 2 + 0.2, HD / 2 + 0.2, 0), fy = fp.hi + 0.42;
  const hutRec = [hx + 1.55, hz + HD / 2 + 1.9];
  { // piers + floor frame
    for (const px of [-1.5, 0, 1.5]) for (const pz of [-0.9, 0.9]) { const x = hx + px, z = hz + pz, g = env.groundY(x, z), h = fy - 0.18 - (g - 0.25); panel.raw(place(bevBox(0.36, h, 0.36, 0.04, 0.5), [x, g - 0.25 + h / 2, z]), CONC, true); }
    steel.raw(place(bevBox(HW + 0.2, 0.18, HD + 0.2, 0.03, 1), [hx, fy - 0.09, hz]), 0x3a4046, true);
    // walls
    const wall = (w, h, d, x, y, z) => panel.raw(place(bevBox(w, h, d, 0.025, 2.4), [x, y, z]), 0xffffff, true);
    const zf = hz + HD / 2 - ht / 2, dx0 = hx + 0.35, dx1 = hx + 1.3;
    wall(HW, HH, ht, hx, fy + HH / 2, hz - HD / 2 + ht / 2);
    wall(ht, HH, HD - 2 * ht, hx - HW / 2 + ht / 2, fy + HH / 2, hz); wall(ht, HH, HD - 2 * ht, hx + HW / 2 - ht / 2, fy + HH / 2, hz);
    wall(dx0 - (hx - HW / 2), HH, ht, (dx0 + hx - HW / 2) / 2, fy + HH / 2, zf);
    wall(hx + HW / 2 - dx1, HH, ht, (dx1 + hx + HW / 2) / 2, fy + HH / 2, zf);
    wall(dx1 - dx0, HH - 2.05, ht, (dx0 + dx1) / 2, fy + 2.05 + (HH - 2.05) / 2, zf);
    steel.raw(place(bevBox(HW + 0.36, 0.14, HD + 0.36, 0.03, 1), [hx, fy + HH + 0.07, hz]), 0x8f9593, true);
    panel.raw(place(box(HW - 2 * ht, 0.04, HD - 2 * ht, 1), [hx, fy + 0.02, hz]), 0x5a5f63, true);
    // orange band + skirt + door frame
    for (const [w, x, z, d] of [[dx0 - (hx - HW / 2), (dx0 + hx - HW / 2) / 2, zf, ht], [hx + HW / 2 - dx1, (dx1 + hx + HW / 2) / 2, zf, ht]]) matte.raw(place(box(w + 0.02, 0.1, d + 0.03, 1), [x, fy + 0.95, z]), ORANGE, true);
    matte.raw(place(box(HW + 0.03, 0.1, ht + 0.03, 1), [hx, fy + 0.95, hz - HD / 2 + ht / 2]), ORANGE, true);
    for (const s of [-1, 1]) matte.raw(place(box(ht + 0.03, 0.1, HD - 2 * ht, 1), [hx + s * (HW / 2 - ht / 2), fy + 0.95, hz]), ORANGE, true);
    for (const s of [0, 1]) haz.raw(place(box(0.07, 2.05, 0.15, 0.4), [s ? dx1 + 0.035 : dx0 - 0.035, fy + 1.025, zf + 0.02]), 0xffffff, true);
    // interior: rack, desk + monitor, ceiling light strip, wall liner
    steel.raw(place(bevBox(1.15, 1.85, 0.5, 0.03, 1), [hx - 0.55, fy + 0.04 + 0.925, hz - HD / 2 + ht + 0.28]), 0x2a3036, true);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) led.raw(place(new THREE.BoxGeometry(0.05, 0.03, 0.02), [hx - 0.98 + c * 0.1, fy + 0.5 + r * 0.22, hz - HD / 2 + ht + 0.54]), ((r * 3 + c * 5) % 7 === 0) ? AMBER : GREEN, true);
    matte.raw(place(bevBox(1.1, 0.05, 0.6, 0.01, 1), [hx + 0.95, fy + 0.78, hz - 0.65]), 0x8a8f90, true);
    for (const sx of [-0.5, 0.5]) matte.raw(place(box(0.05, 0.74, 0.5, 1), [hx + 0.95 + sx, fy + 0.4, hz - 0.65]), 0x6e7478, true);
    matte.raw(place(bevBox(0.56, 0.38, 0.05, 0.015, 1), [hx + 0.95, fy + 1.12, hz - 0.9]), 0x14171a, true);
    screens.raw(place(new THREE.PlaneGeometry(0.5, 0.31), [hx + 0.95, fy + 1.12, hz - 0.872]), 0xffffff, true);
    led.raw(place(new THREE.BoxGeometry(1.4, 0.02, 0.08), [hx + 0.2, fy + HH - 0.07, hz - 0.1]), [2.2, 2.4, 2.3], true);
    for (const [w, h, d, x, y, z] of [
      [HW - 2 * ht, HH - 0.12, 0.02, hx, fy + HH / 2 + 0.03, hz - HD / 2 + ht + 0.011], [0.02, HH - 0.12, HD - 2 * ht, hx - HW / 2 + ht + 0.011, fy + HH / 2 + 0.03, hz],
      [0.02, HH - 0.12, HD - 2 * ht, hx + HW / 2 - ht - 0.011, fy + HH / 2 + 0.03, hz], [HW - 2 * ht, 0.02, HD - 2 * ht, hx, fy + HH - 0.012, hz],
    ]) steel.raw(place(box(w, h, d, 1), [x, y, z]), 0x1e252b, true);
    steel.raw(place(cylY(0.2, 0.2, 0.05, 12), [hx + 0.45, fy + 0.5, hz - 0.1]), 0x3b4349, true);
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.4; steel.raw(tube([hx + 0.45 + Math.cos(a) * 0.16, fy + 0.04, hz - 0.1 + Math.sin(a) * 0.16], [hx + 0.45, fy + 0.5, hz - 0.1], 0.012, 0.012, 5), GALV, true); }
    matte.raw(place(box(0.28, 0.012, 0.2, 1), [hx + 0.75, fy + 0.81, hz - 0.62], [0, 0.3, 0]), 0xd9d4c0, true);
    matte.raw(place(cylY(0.04, 0.04, 0.09, 10), [hx + 1.28, fy + 0.805, hz - 0.5]), 0xb03a2a, true);
    for (let i = 0; i < 3; i++) { const y = fy + 1.0 + i * 0.42; steel.raw(place(box(0.32, 0.03, 0.9, 1), [hx + 1.5, y, hz - 0.2]), 0x6b7378, true); matte.raw(place(box(0.22, 0.2, 0.28, 1), [hx + 1.5, y + 0.115, hz - 0.45 + (i % 2) * 0.4]), [0x4d5538, 0xd8a416, 0x6b6f72][i], true); }
    // door standing ajar (hinge at the left of the opening)
    const hingeX = dx0, hingeZ = hz + HD / 2 + 0.01, dw = dx1 - dx0 - 0.02;
    const hinge = [hingeX, fy + 0.04, hingeZ], dRot = [0, -0.85, 0];
    matte.raw(sub(bevBox(dw, 2.0, 0.07, 0.02, 1), [dw / 2, 1.0, 0.04], hinge, dRot), 0xc7cbc9, true);
    steel.raw(sub(box(0.14, 0.06, 0.1, 1), [dw - 0.1, 1.0, 0.12], hinge, dRot), 0x30363b, true);
    haz.raw(sub(box(0.05, 2.0, 0.09, 0.4), [dw - 0.02, 1.0, 0.04], hinge, dRot), 0xffffff, true);
    // window with the live seismograph trace + frame
    const wx = hx - 0.95, wy = fy + 1.5, wz = hz + HD / 2 + 0.002;
    screens.raw(place(new THREE.PlaneGeometry(0.86, 0.54), [wx, wy, wz + 0.004]), 0xffffff, true);
    for (const [w, h, x, y] of [[0.96, 0.05, 0, 0.295], [0.96, 0.05, 0, -0.295], [0.05, 0.55, -0.455, 0], [0.05, 0.55, 0.455, 0]]) steel.raw(place(bevBox(w, h, 0.045, 0.012, 1), [wx + x, wy + y, wz + 0.01]), 0x30363b, true);
    // roof gear: heat exchanger, vents, whip, solar pair
    steel.raw(place(bevBox(0.95, 0.5, 0.62, 0.04, 1), [hx - 1.0, fy + HH + 0.14 + 0.25, hz - 0.55]), 0x7d8588, true);
    for (let i = 0; i < 6; i++) steel.raw(place(box(0.86, 0.02, 0.02, 1), [hx - 1.0, fy + HH + 0.34 + i * 0.05, hz - 0.55 + 0.32]), 0x2a2f33, true);
    steel.tube([hx + 1.5, fy + HH + 0.14, hz - 0.8], [hx + 1.5, fy + HH + 1.0, hz - 0.8], 0.06, 0.05, 8, GALV); steel.tube([hx + 1.5, fy + HH + 1.0, hz - 0.8], [hx + 1.5, fy + HH + 1.08, hz - 0.8], 0.09, 0.09, 8, GALV);
    steel.tube([hx + 1.7, fy + HH + 0.14, hz + 0.7], [hx + 1.7, fy + HH + 2.4, hz + 0.7], 0.012, 0.007, 5, 0x9aa1a6);
    solar.raw(place(bevBox(1.6, 0.045, 1.0, 0.012, 0.94), [hx + 0.55, fy + HH + 0.14 + 0.32, hz + 0.25], [0.42, 0, 0]), 0xffffff, true);
    for (const sx of [-0.65, 0.65]) { steel.tube([hx + 0.55 + sx, fy + HH + 0.14, hz + 0.62], [hx + 0.55 + sx, fy + HH + 0.14 + 0.24, hz + 0.62], 0.02, 0.02, 6, GALV); steel.tube([hx + 0.55 + sx, fy + HH + 0.14, hz - 0.05], [hx + 0.55 + sx, fy + HH + 0.14 + 0.48, hz - 0.05], 0.02, 0.02, 6, GALV); }
    // wall labels
    decals.addW(decalGeo(atlas.rects.hut, 1.24, 0.366), [hx - 0.9, fy + 0.62, hz + HD / 2 + 0.005], null, 0xffffff);
    decals.addW(decalGeo(atlas.rects.hot, 0.34, 0.28), [hx - 1.42, fy + 2.0, hz + HD / 2 + 0.005], null, 0xffffff);
    decals.addW(decalGeo(atlas.rects.cs4, 0.9, 0.5), [hx - 1.82, fy + 1.4, hz + 0.05], [0, -Math.PI / 2, 0], 0xffffff);
    // steps to the door
    const g = env.groundY(hx + 0.8, hz + HD / 2 + 0.5), rise = fy - g;
    if (rise > 0.12) {
      const n = Math.max(1, Math.round(rise / 0.2)), tw = 1.15;
      for (let i = 0; i < n; i++) { const top = g + rise * (i + 1) / n, d = 0.34; panel.raw(place(bevBox(tw, 0.07, d, 0.015, 0.6), [hx + 0.83, top - 0.035, hz + HD / 2 + 0.12 + (n - i) * d - d / 2]), 0xb4b8b6, true); }
      for (const sx of [-1, 1]) steel.raw(place(box(0.04, 0.9, 0.04, 1), [hx + 0.83 + sx * 0.6, g + 0.55, hz + HD / 2 + 0.35 + n * 0.34]), GALV, true);
    }
    colliders.push(aabb(hx, hz, HW + 0.4, HD + 0.4, 0, fp.lo - 0.5, fy + HH + 0.3));
  }

  // battery cases beside the hut
  { const items = [[hx + 2.85, hz + 0.35, 0.12, 0], [hx + 2.8, hz - 0.45, -0.05, 0], [hx + 2.85, hz + 0.35, 0.12, 1], [hx + 3.9, hz + 0.1, 0.3, 0]];
    for (const [x, z, yaw, stack] of items) {
      const g = env.groundY(x, z), y = g + 0.23 + stack * 0.47;
      matte.raw(place(bevBox(0.92, 0.45, 0.58, 0.05, 0.8), [x, y, z], [0, yaw, 0]), OLIVE, true);
      matte.raw(place(box(0.94, 0.03, 0.6, 1), [x, y + 0.02, z], [0, yaw, 0]), 0x1e211b, true);
      for (const lx of [-0.28, 0.28]) steel.raw(place(box(0.07, 0.1, 0.03, 1), [x + lx * Math.cos(yaw), y, z - lx * Math.sin(yaw) + 0.3], [0, yaw, 0]), 0x9aa0a4, true);
      matte.raw(place(box(0.9, 0.04, 0.12, 1), [x, y + 0.226, z], [0, yaw, 0]), ORANGE, true);
      decals.addW(decalGeo(atlas.rects.batt, 0.4, 0.246), [x + 0.31 * Math.sin(yaw) * 0.0 + Math.sin(yaw) * 0.0, y + 0.0, z + 0.295 * Math.cos(yaw) + 0.004], [0, yaw, 0], 0xffffff);
    }
    colliders.push(aabb(hx + 2.85, hz + 0.0, 1.3, 1.6, 0.12, env.groundY(hx + 2.85, hz) - 0.3, env.groundY(hx + 2.85, hz) + 1.1));
    colliders.push(aabb(hx + 3.9, hz + 0.1, 1.0, 0.9, 0.3, env.groundY(hx + 3.9, hz) - 0.3, env.groundY(hx + 3.9, hz) + 0.6));
    // gold foil data-logger box + silver one by the hut's west wall
    for (const [x, z, h, gold] of [[hx - 2.6, hz + 0.8, 1.1, 1], [hx - 2.55, hz - 0.6, 0.8, 0]]) {
      const g = env.groundY(x, z); (gold ? foilG : foilS).raw(place(bevBox(1.0, h, 0.9, 0.07, 1.2), [x, g + h / 2 + 0.04, z], [0, 0.2, 0]), 0xffffff, true);
      steel.raw(place(box(1.04, 0.04, 0.94, 1), [x, g + 0.03, z], [0, 0.2, 0]), 0x3a4046, true);
      colliders.push(aabb(x, z, 1.05, 0.95, 0.2, g - 0.3, g + h + 0.1));
    }
  }
  // cable drums
  for (const [x, z, flat] of [[hx + 3.3, hz + 2.3, 0], [hx + 4.4, hz + 1.7, 1]]) {
    const g = env.groundY(x, z);
    if (!flat) { const y = g + 0.5;
      for (const s of [-1, 1]) matte.raw(place(tube([x + s * 0.26, y, z], [x + s * 0.3, y, z], 0.5, 0.5, 20, false), null, null), 0x7b5c3c, true);
      matte.raw(place(tube([x - 0.26, y, z], [x + 0.26, y, z], 0.42, 0.42, 20, false)), YEL, true); steel.raw(place(tube([x - 0.31, y, z], [x + 0.31, y, z], 0.07, 0.07, 8, false)), GALV, true);
      worldCable(matte, [[x + 0.1, y - 0.42, z], [x + 0.6, g + 0.03, z + 0.2], [x + 1.2, g + 0.03, z + 0.7], [x + 1.9, g + 0.03, z + 0.6]], 0.03, YEL);
    } else { const y = g + 0.02;
      for (const s of [0, 1]) matte.raw(place(tube([x, y + s * 0.54, z], [x, y + 0.04 + s * 0.54, z], 0.5, 0.5, 20, false)), 0x7b5c3c, true);
      matte.raw(place(tube([x, y + 0.04, z], [x, y + 0.54, z], 0.42, 0.42, 20, false)), 0xc7ccd0, true);
    }
    colliders.push(kit.cyl(x, z, 0.62, g - 0.2, g + 1.1));
  }

  // dish mast (lattice, guyed)
  const mx = hx - 4.6, mz = hz - 1.8, gm = env.groundY(mx, mz), Hm = 8.8, r3 = 0.34;
  const triPt = (i, r, y) => [mx + Math.sin(i * TAU / 3) * r, y, mz + Math.cos(i * TAU / 3) * r];
  {
    matte.raw(place(bevBox(1.1, 0.5, 1.1, 0.06, 1), [mx, gm - 0.05, mz]), CONC, true); steel.raw(place(box(0.78, 0.05, 0.78, 1), [mx, gm + 0.22, mz]), 0x6c7378, true);
    for (let i = 0; i < 3; i++) steel.raw(tube(triPt(i, r3, gm + 0.25), triPt(i, r3, gm + Hm), 0.032, 0.03, 6), GALV, true);
    const lv = 8, dh = (Hm - 0.25) / lv;
    for (let l = 0; l <= lv; l++) for (let i = 0; i < 3; i++) {
      steel.raw(tube(triPt(i, r3, gm + 0.25 + l * dh), triPt(i + 1, r3, gm + 0.25 + l * dh), 0.014, 0.014, 5), GALV, true);
      if (l < lv) steel.raw(tube(triPt(i, r3, gm + 0.25 + l * dh), triPt(i + 1, r3, gm + 0.25 + (l + 1) * dh), 0.012, 0.012, 5), GALV, true);
    }
    // top platform + positioner + dish aimed at the sky toward the ship
    const yT = gm + Hm;
    steel.raw(place(bevBox(0.9, 0.06, 0.9, 0.015, 1), [mx, yT + 0.03, mz]), 0x6c7378, true);
    steel.raw(place(cylY(0.09, 0.07, 0.4, 10), [mx, yT + 0.06, mz]), 0x3a4146, true);
    const az = Math.atan2(0 - mx, 18 - mz), el = 0.68, dc = [mx, yT + 0.78, mz], dr = [-el, az, 0];
    // dish faces +Z in its own frame → pitch up (negative X rotation lifts +Z), yaw toward the ship
    dish.raw(sub(dishGeo(0.95, 0.3, 28), [0, 0, 0], dc, dr), 0xe6e8e4, true);
    dish.raw(sub(new THREE.TorusGeometry(0.95, 0.018, 6, 28).translate(0, 0, 0.3), [0, 0, 0], dc, dr), 0xcfd3cf, true);
    dish.raw(sub(tube([0, 0, -0.05], [0, 0, 0.12], 0.17, 0.12, 12, false), [0, 0, 0], dc, dr), 0x7d8588, true);
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.5; steel.raw(sub(tube([Math.cos(a) * 0.94, Math.sin(a) * 0.94, 0.3], [0, 0, 0.82], 0.012, 0.012, 4), [0, 0, 0], dc, dr), GALV, true); }
    dish.raw(sub(tube([0, 0, 0.78], [0, 0, 0.9], 0.07, 0.02, 10), [0, 0, 0], dc, dr), 0xd8dbd6, true);
    steel.raw(tube([mx, yT + 0.2, mz], dc, 0.05, 0.05, 8), 0x4a5056, true);
    steel.raw(tube([mx + 0.25, yT + 0.06, mz + 0.2], [mx + 0.25, yT + 2.0, mz + 0.2], 0.011, 0.006, 5), 0x9aa1a6, true);
    steel.raw(tube([mx - 0.25, yT + 0.06, mz - 0.2], [mx - 0.25, yT + 1.5, mz - 0.2], 0.01, 0.006, 5), 0x9aa1a6, true);
    // guys
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + 0.6, ax = mx + Math.sin(a) * 5.2, az2 = mz + Math.cos(a) * 5.2, ag = env.groundY(ax, az2);
      steel.raw(tube(triPt(i, r3, gm + Hm * 0.7), [ax, ag + 0.25, az2], 0.008, 0.008, 4), 0x9aa1a6, true);
      matte.raw(place(bevBox(0.5, 0.35, 0.5, 0.04, 1), [ax, ag - 0.05, az2]), CONC, true); steel.raw(place(new THREE.TorusGeometry(0.08, 0.016, 5, 10), [ax, ag + 0.2, az2], [Math.PI / 2, 0, 0]), GALV, true);
    }
    colliders.push(kit.cyl(mx, mz, 0.7, gm - 0.3, gm + 3));
  }

  // roof-top solar + ground cable run from hut to the tower junction + yellow tower junction box
  { const leg = towerLegs[0], jx = leg.x, jz = leg.z, jy = leg.y;
    const gx = hx + HW / 2 + 0.05, gz = hz + 0.2, pts = [[gx, fy + 0.5, gz], [gx + 0.2, fy + 0.15, gz + 0.1]];
    const nPts = 16, x0 = gx + 0.5, z0b = gz + 0.2;
    for (let i = 0; i <= nPts; i++) { const t = i / nPts, x = lerp(x0, jx - 0.8, t), z = lerp(z0b, jz, t) + Math.sin(t * 7.0) * 0.45 * Math.sin(t * Math.PI); pts.push([x, env.groundY(x, z) + 0.045, z]); }
    worldCable(matte, pts, 0.045, RUBBER, 5);
    worldCable(matte, pts.map((p) => [p[0] + 0.1, p[1], p[2] - 0.1]).slice(2), 0.028, YEL, 4);
    matte.raw(place(bevBox(0.5, 0.36, 0.3, 0.03, 1), [jx - 0.75, jy + 0.2, jz]), YEL, true);
    led.raw(place(new THREE.BoxGeometry(0.04, 0.04, 0.02), [jx - 0.75, jy + 0.28, jz + 0.16]), GREEN, true);
  }

  // recorder (log phlegethon.1) on a hard case by the hut door
  const recG = env.groundY(hutRec[0], hutRec[1]), recBase = recG + 0.52;
  matte.raw(place(bevBox(0.85, 0.5, 0.55, 0.05, 0.8), [hutRec[0], recG + 0.27, hutRec[1]], [0, 0.35, 0]), OLIVE, true);
  matte.raw(place(box(0.87, 0.03, 0.57, 1), [hutRec[0], recG + 0.29, hutRec[1]], [0, 0.35, 0]), 0x1e211b, true);
  const rec = kit.recorder({ title: 'LOG 01', sub: 'SURVEY C', accent: '#ff9b3a' });
  rec.position.set(hutRec[0], recBase + 0.63, hutRec[1]); rec.rotation.y = 0.35;
  colliders.push(aabb(hutRec[0], hutRec[1], 0.95, 0.65, 0.35, recG - 0.2, recG + 0.55));

  // lava soot: parts hanging below the deck darken and warm-shift toward the channel
  const soot = (x, y, z, c) => { const s = smooth(deckY + 0.25, deckY - 1.8, y) * 0.5; c[0] *= 1 - s * 0.9; c[1] *= 1 - s * 0.95; c[2] *= 1 - s * 1.0; };
  matte.shadeAll(soot); steel.shadeAll(soot); haz.shadeAll(soot);
  // ───────────── assemble draw calls ─────────────
  const meshes = [];
  const addMesh = (m, name, shadow = true) => { m.name = name; if (!shadow) { m.castShadow = false; m.receiveShadow = false; } group.add(m); meshes.push(m); return m; };
  addMesh(matte.mesh(mMatte, Mb), 'matte'); addMesh(steel.mesh(mSteel, Mb), 'steel'); addMesh(deck.mesh(mDeck, Mb), 'deck'); addMesh(haz.mesh(mHaz, Mb), 'haz');
  addMesh(panel.mesh(mPanel, Mb), 'panels'); addMesh(dish.mesh(mDish, Mb), 'dish'); addMesh(solar.mesh(mSolar, Mb), 'solar');
  addMesh(foilG.mesh(mFoilG, Mb), 'foilGold'); addMesh(foilS.mesh(mFoilS, Mb), 'foilSilver'); addMesh(glass.mesh(mGlass, Mb), 'glass');
  addMesh(led.mesh(mLed, Mb), 'leds', false); addMesh(warnA.mesh(warnMatA, Mb), 'warnA', false); addMesh(warnB.mesh(warnMatB, Mb), 'warnB', false);
  addMesh(screens.mesh(mScreen, Mb), 'screens', false);
  addMesh(decals.mesh(mDecal, Mb), 'decals', false).renderOrder = 2;
  for (const t of towerLegs) colliders.push(kit.cyl(t.x, t.z, 0.62, t.y - 0.5, t.y + 8));
  rec.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(rec);

  // ───────────── lights ─────────────
  const flickLight = kit.pointLight(0xff7a2e, 46, 34, [Wx(uc, 0), lavaY + 2.6, Wz(uc, 0)]); group.add(flickLight);
  const beaconTop = [mx, gm + Hm + 2.2, mz];
  const beacon = kit.beacon(beaconTop, { color: 0xb8ecff, period: 2.6, duty: 0.12, size: 0.1, lightI: 8, range: 18, phase: 0.3 }); group.add(beacon.group);

  // ───────────── interactables ─────────────
  const stationPos = W3(uW - 2.0, gy(uW - 2.0, 0) + 1.15, 0);
  interactables.push(kit.interactable({ id: 'poi.world.phlegethon.poi.seismic', label: 'Inspect seismic station', pos: stationPos, radius: 3.6, object: meshes[0], lineId: 'world.phlegethon.poi.seismic' }));
  interactables.push(kit.interactable({ id: 'log.phlegethon.1', label: 'Play field recorder', pos: new THREE.Vector3(hutRec[0], recBase + 0.9, hutRec[1]), radius: 2.4, object: rec, lineId: 'log.phlegethon.1', log: true }));

  // ───────────── animation ─────────────
  const amber = new THREE.Color(0xffa030);
  group.userData.frame = { Cx, z0, uW, uE, deckY, lavaY, wCh, hut: [hx, fy, hz], mast: [mx, gm, mz], rec: hutRec, east: [Wx(uE + 5.2), Wz(uE + 5.2)], west: [Wx(uW), Wz(uW)] };
  return {
    group, interactables, colliders,
    update(dt, t) {
      const f = 1 + 0.16 * Math.sin(t * 7.3) + 0.11 * Math.sin(t * 13.1 + 1.7) + 0.07 * Math.sin(t * 29.0 + 0.3) + (Math.sin(t * 1.9) > 0.92 ? 0.25 : 0);
      flickLight.intensity = 46 * f;
      const pa = (t % 1.6) / 1.6, ka = pa < 0.18 ? 1 : 0.06, kb = ((pa + 0.5) % 1) < 0.18 ? 1 : 0.06;
      warnMatA.color.copy(amber).multiplyScalar(1 + 8 * ka); warnMatB.color.copy(amber).multiplyScalar(1 + 8 * kb);
      traceTex.offset.x = (t * 0.045) % 1;
      beacon.update(t); rec.userData.ledUpdate?.(t);
    },
    dispose() {},
  };
}
