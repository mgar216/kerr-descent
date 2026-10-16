// ORPHEUS · Sentinel Observatory — the telescope dome (Dr. Ilse Varga's instrument).
// Static: foundation, panelled drum, ring rail + wheel bogies, door vestibule, access ramp, telescope pier.
// Animated (closed-form in t, no allocation): the slit dome slews in slow deliberate moves, the telescope follows ~1.4 s behind.
import * as THREE from 'three';
import { GM, makeBatch, identityFrame, rbox, lathe, strut, tubeGeo, wedgeGeo, mergeAll, obbBoxes } from './poi_charon_icekit.js';

export const DOME = { R: 5.5, HW: 0.95, SPR: 2.9, DR: 5.76, DH: 2.45, TH: 0.17 };
const PSI_E = Math.PI / 2 + 0.2, UVK = 0.25;

// ───────────────────────────── slew law ─────────────────────────────
const SLEW_T = 38, SLEW_D = 12;
const azK = (k) => 0.15 + 0.55 * Math.sin(k * 2.399 + 0.8) + 0.30 * Math.sin(k * 0.713 + 2.0);
/** dome azimuth (rad, slot-local, + toward the observer's right) — hold ≈26 s, slew ≈12 s */
export function domeAz(t) {
  const k = Math.floor(t / SLEW_T), f = (t - k * SLEW_T) / SLEW_D, e = f >= 1 ? 1 : f * f * (3 - 2 * f);
  return azK(k) + (azK(k + 1) - azK(k)) * e;
}

// ───────────────────────────── shell geometry (hoop parameterisation → constant-width slit) ─────────────────────────────
const P3 = (a, p, r) => [r * Math.sin(a), r * Math.cos(a) * Math.sin(p), r * Math.cos(a) * Math.cos(p)];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

class GB {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  v(x, y, z, nx, ny, nz, u, v) { this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v); return this.pos.length / 3 - 1; }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setIndex(this.idx);
    return g;
  }
}

function addGrid(gb, r, aLo, aHi, pLo, pHi, na, np, outward) {
  const base = gb.pos.length / 3, k = outward ? 1 : -1;
  for (let i = 0; i <= na; i++) {
    const a = aLo + (aHi - aLo) * i / na, sa = Math.sin(a), ca = Math.cos(a);
    for (let j = 0; j <= np; j++) {
      const p = pLo + (pHi - pLo) * j / np, sp = Math.sin(p), cp = Math.cos(p);
      gb.v(r * sa, r * ca * sp, r * ca * cp, k * sa, k * ca * sp, k * ca * cp, a * r * UVK, p * r * UVK);
    }
  }
  for (let i = 0; i < na; i++) for (let j = 0; j < np; j++) {
    const a = base + i * (np + 1) + j, b = a + 1, c = a + np + 1, d = c + 1;
    if (outward) gb.idx.push(a, c, b, b, c, d); else gb.idx.push(a, b, c, b, d, c);
  }
}

/** quad strip between matching boundary point lists A (outer) / B (inner); flat normals oriented along hint(k) */
function addStrip(gb, A, B, hint) {
  for (let k = 0; k < A.length - 1; k++) {
    const a = A[k], b = A[k + 1], c = B[k], d = B[k + 1], e1 = sub3(b, a), e2 = sub3(c, a);
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const h = hint(k), flip = n[0] * h[0] + n[1] * h[1] + n[2] * h[2] < 0, l = Math.hypot(n[0], n[1], n[2]) || 1, s = (flip ? -1 : 1) / l;
    n = [n[0] * s, n[1] * s, n[2] * s];
    const u0 = k * 0.3, u1 = (k + 1) * 0.3;
    const i0 = gb.v(a[0], a[1], a[2], n[0], n[1], n[2], u0, 0), i1 = gb.v(b[0], b[1], b[2], n[0], n[1], n[2], u1, 0), i2 = gb.v(c[0], c[1], c[2], n[0], n[1], n[2], u0, 0.2), i3 = gb.v(d[0], d[1], d[2], n[0], n[1], n[2], u1, 0.2);
    if (!flip) gb.idx.push(i0, i1, i2, i1, i3, i2); else gb.idx.push(i0, i2, i1, i1, i2, i3);
  }
}

/** closed curved slab: outer surface + edges → `out`, inner surface → `inn` */
function shellSlab(out, inn, r, th, aLo, aHi, pLo, pHi, na, np) {
  addGrid(out, r, aLo, aHi, pLo, pHi, na, np, true);
  addGrid(inn, r - th, aLo, aHi, pLo, pHi, na, np, false);
  const ri = r - th, pj = (j) => pLo + (pHi - pLo) * j / np, ai = (i) => aLo + (aHi - aLo) * i / na, eps = 0.01;
  const alongP = (a, rr) => Array.from({ length: np + 1 }, (_, j) => P3(a, pj(j), rr));
  const alongA = (p, rr) => Array.from({ length: na + 1 }, (_, i) => P3(ai(i), p, rr));
  addStrip(out, alongP(aLo, r), alongP(aLo, ri), (k) => sub3(P3(aLo - eps, pj(k), r), P3(aLo, pj(k), r)));
  addStrip(out, alongP(aHi, r), alongP(aHi, ri), (k) => sub3(P3(aHi + eps, pj(k), r), P3(aHi, pj(k), r)));
  addStrip(out, alongA(pLo, r), alongA(pLo, ri), (k) => sub3(P3(ai(k), pLo - eps, r), P3(ai(k), pLo, r)));
  addStrip(out, alongA(pHi, r), alongA(pHi, ri), (k) => sub3(P3(ai(k), pHi + eps, r), P3(ai(k), pHi, r)));
}

const hoopPt = (x, p, r) => { const rho = Math.sqrt(r * r - x * x); return [x, rho * Math.sin(p), rho * Math.cos(p)]; };
const arcPts = (x, p0, p1, r, n) => Array.from({ length: n + 1 }, (_, i) => hoopPt(x, p0 + (p1 - p0) * i / n, r));

// ───────────────────────────── build ─────────────────────────────
/** B: build context from poi_charon_sentinel.js. (cx, cz): dome centre in slot-local metres. */
export function buildDome(B, cx, cz) {
  const { fr, kit, bat, mat, env } = B, { P, M, D, G, H } = bat;
  const { R, HW, SPR, DR, DH, TH } = DOME, X = cx, Z = cz;
  const drumH = DH - 0.26;

  // ── foundation, drum, bands, pilasters ──
  P.add(lathe([[0, -0.45], [6.55, -0.45], [6.55, 0.14], [6.42, 0.26], [0, 0.26]], 72), { p: [X, 0, Z], color: 0x80848a, dirt: 0.3 });
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; M.add(GM.Cylinder(0.06, 0.06, 0.05, 8), { p: [X + Math.sin(a) * 6.18, 0.285, Z + Math.cos(a) * 6.18], color: 0xa4aab0 }); }
  P.add(GM.Cylinder(DR, DR, drumH, 72, 1, true), { p: [X, 0.26 + drumH / 2, Z], uv: 0, uvS: [Math.PI * DR, drumH * 0.5], color: 0xe6e8e9, dirt: 0.5, dirtH: 1.3 });
  P.add(GM.Cylinder(DR + 0.02, DR + 0.02, 0.34, 72, 1, true), { p: [X, 1.5, Z], uv: 0, uvS: [Math.PI * DR, 0.2], color: 0xe36a14 });
  P.add(GM.Cylinder(DR + 0.03, DR + 0.03, 0.3, 72, 1, true), { p: [X, 0.42, Z], uv: 0, uvS: [Math.PI * DR, 0.2], color: 0x4a4e54 });
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2; if (Math.cos(a) > 0.93) continue;
    P.add(GM.Box(0.15, drumH - 0.16, 0.08), { p: [X + Math.sin(a) * (DR + 0.03), 0.26 + drumH / 2, Z + Math.cos(a) * (DR + 0.03)], r: [0, a, 0], color: 0xcfd3d6, dirt: 0.4, dirtH: 1.2 });
  }
  // ventilation louvres (rear / flanks) + wall lamps beside the door
  for (const a of [2.0, Math.PI, -2.0, -1.2]) {
    const px = X + Math.sin(a) * (DR + 0.03), pz = Z + Math.cos(a) * (DR + 0.03);
    D.add(GM.Box(1.5, 0.85, 0.06), { p: [px, 1.15, pz], r: [0, a, 0], color: 0x3c4046, uv: 0 });
    for (let s = 0; s < 6; s++) M.add(GM.Box(1.46, 0.035, 0.07), { p: [px + Math.sin(a) * 0.01, 0.84 + s * 0.12, pz + Math.cos(a) * 0.01], r: [0, a, 0], color: 0x9aa0a6 });
  }
  for (const s of [-1, 1]) {
    const a = s * 0.66, px = X + Math.sin(a) * (DR + 0.03), pz = Z + Math.cos(a) * (DR + 0.03), nx = Math.sin(a), nz = Math.cos(a);
    D.add(rbox(0.3, 0.2, 0.2, 0.03), { p: [px + nx * 0.09, 2.05, pz + nz * 0.09], r: [0, a, 0], color: 0x42464c });
    G.add(GM.Box(0.22, 0.11, 0.02), { p: [px + nx * 0.2, 2.05, pz + nz * 0.2], r: [0, a, 0], color: [9, 7.2, 4.6], uv: 0 });
  }
  // title band on the drum (sign atlas)
  B.sign(new THREE.CylinderGeometry(DR + 0.045, DR + 0.045, 0.56, 24, 1, true, -1.48, 0.78), 'banner', { p: [X, 0.98, Z], uv: 0 });

  // ── ring rail + wheel bogies ──
  M.add(GM.Torus(5.5, 0.1, 8, 96), { p: [X, 2.5, Z], r: [Math.PI / 2, 0, 0], color: 0xc4cad0 });
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + 0.1, px = X + Math.sin(a) * 5.5, pz = Z + Math.cos(a) * 5.5;
    D.add(GM.Box(0.5, 0.3, 0.34), { p: [px, 2.58, pz], r: [0, a, 0], color: 0x3e4247 });
    M.add(GM.Cylinder(0.16, 0.16, 0.12, 14), { p: [px, 2.5, pz], r: [0, a, Math.PI / 2], color: 0xb2b8be });
  }

  // ── door vestibule + ramp ──
  const vz = Z + DR + 0.35, vd = 2.5, vw = 2.9, vh = 2.14, vy0 = 0.28, front = vz + vd / 2;
  P.add(rbox(vw, vh, vd, 0.05), { p: [X, vy0 + vh / 2, vz], color: 0xe8eaeb, dirt: 0.45 });
  P.add(GM.Box(vw + 0.04, 0.2, 0.03), { p: [X, 2.12, front + 0.012], color: 0xe36a14, uv: 0 });
  // hazard-framed sliding door, slightly ajar (a slit of warm light)
  const fz = front + 0.03;
  D.add(GM.Box(1.5, 2.0, 0.05), { p: [X, vy0 + 1.0, fz - 0.005], color: 0x555a61 });
  for (const s of [-1, 1]) H.add(GM.Box(2.15, 0.11, 0.07), { p: [X + s * 0.8, vy0 + 1.075, fz + 0.02], r: [0, 0, Math.PI / 2], uv: 0, uvS: [0.9, 1] });
  H.add(GM.Box(1.7, 0.11, 0.07), { p: [X, vy0 + 2.1, fz + 0.02], uv: 0, uvS: [0.7, 1] });
  G.add(GM.Plane(0.07, 1.86), { p: [X + 0.03, vy0 + 1.0, fz + 0.04], color: [7.5, 4.6, 1.9] });
  D.add(rbox(0.12, 2.0, 0.06, 0.02), { p: [X - 0.74, vy0 + 1.0, fz + 0.02], color: 0x464a50 });
  D.add(rbox(0.12, 2.0, 0.06, 0.02), { p: [X + 0.74, vy0 + 1.0, fz + 0.02], color: 0x464a50 });
  M.add(GM.Box(0.05, 0.42, 0.07), { p: [X + 0.58, vy0 + 1.0, fz + 0.05], color: 0xc4cad0 });
  D.add(rbox(0.2, 0.34, 0.07, 0.02), { p: [X + 1.12, 1.45, fz + 0.01], color: 0x2c3036 });
  G.add(GM.Plane(0.1, 0.07), { p: [X + 1.12, 1.55, fz + 0.05], color: [0.6, 5.5, 1.2] });
  for (let i = 0; i < 3; i++) G.add(GM.Plane(0.035, 0.035), { p: [X + 1.06 + i * 0.06, 1.4, fz + 0.05], color: [1.2, 3.6, 5.2] });
  // 'caution: rotating dome' plate + overhead lamp
  B.sign(new THREE.PlaneGeometry(0.9, 0.42), 'rot', { p: [X - 1.05 - 0.05, 1.95, fz + 0.02], uv: 0 });
  D.add(rbox(0.46, 0.14, 0.2, 0.03), { p: [X, vy0 + 2.25, front + 0.1], color: 0x42464c });
  G.add(GM.Plane(0.36, 0.1), { p: [X, vy0 + 2.18, front + 0.201], color: [9, 8, 6.4] });
  // ramp (wedge) with hazard edge strips and handrails
  const rl = 2.6, rh = 0.28, slope = Math.atan(rh / rl);
  P.add(wedgeGeo(2.5, rh, rl), { p: [X, 0, front], color: 0x6c7076, dirt: 0.2 });
  for (const s of [-1, 1]) {
    H.add(GM.Box(0.12, 0.05, rl), { p: [X + s * 1.31, rh / 2 + 0.0, front + rl / 2], r: [slope, 0, 0], uv: 0, uvS: [1, rl / 2.4] });
    for (const t of [0.12, 0.5, 0.88]) {
      const pz = front + rl * t, py = rh * (1 - t);
      M.add(GM.Cylinder(0.025, 0.025, 0.95, 6), { p: [X + s * 1.31, py + 0.475, pz], color: 0xe8b21a });
    }
    const rail = (hh, r) => M.add(strut([X + s * 1.31, rh * 0.88 + hh, front + rl * 0.12], [X + s * 1.31, rh * 0.12 + hh, front + rl * 0.88], r), { uv: 0, color: 0xe8b21a });
    rail(0.95, 0.022); rail(0.5, 0.018);
  }
  // door foot-scraper grating
  D.add(GM.Box(1.5, 0.04, 0.6), { p: [X, rh + 0.015, front + 0.45], r: [slope * 0.7, 0, 0], color: 0x2e3238 });

  // ── pier ──
  M.add(GM.Cylinder(0.42, 0.5, 2.3, 20), { p: [X, 0.26 + 1.15, Z], color: 0xb4bac0 });
  M.add(GM.Cylinder(0.62, 0.62, 0.2, 20), { p: [X, 0.36, Z], color: 0x9aa0a6 });
  D.add(rbox(1.7, 0.1, 1.7, 0.03), { p: [X, 0.31, Z], color: 0x4a4e54 });

  // ── colliders ──
  B.colliders.push(kit.cyl(fr.wx(X, Z), fr.wz(X, Z), R + 0.45, fr.y0 - 0.5, fr.y0 + 8.6));
  B.colliders.push(...obbBoxes(fr, X, vz, vw / 2, vd / 2, 0, 2.5));
  B.colliders.push(...obbBoxes(fr, X, front + 0.6, 1.3, 0.6, 0, 0.3), ...obbBoxes(fr, X, front + 1.5, 1.3, 0.3, 0, 0.18));

  // ───────────── rotating dome ─────────────
  const out = new GB(), inn = new GB(), as = Math.asin(HW / R);
  shellSlab(out, inn, R, TH, as, Math.PI / 2, 0, Math.PI, 14, 48);          // right wing
  shellSlab(out, inn, R, TH, -Math.PI / 2, -as, 0, Math.PI, 14, 48);        // left wing
  shellSlab(out, inn, R, TH, -as, as, PSI_E, Math.PI, 3, 10);               // back band behind the slit
  const ac = Math.asin((HW + 0.46) / (R + 0.18));
  shellSlab(out, out, R + 0.2, 0.12, -ac, ac, PSI_E + 0.04, PSI_E + 0.72, 4, 10);       // shutter leaf 1 (parked)
  shellSlab(out, out, R + 0.36, 0.12, -ac + 0.02, ac - 0.02, PSI_E + 0.30, PSI_E + 0.98, 4, 10);  // leaf 2 stacked above
  const skirt = lathe([[5.12, -0.46], [5.7, -0.46], [5.8, -0.37], [5.8, -0.08], [5.62, 0.0], [5.2, 0.0]], 72);
  { const a = skirt.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * Math.PI * 5.8 * UVK * 2, a.getY(i) * 0.25); }
  const shellOut = new THREE.Mesh(mergeAll([out.geo(), skirt]), B.mat.domePaint); shellOut.castShadow = shellOut.receiveShadow = true;
  const shellIn = new THREE.Mesh(mergeAll([inn.geo()]), B.mat.domeIn); shellIn.castShadow = false; shellIn.receiveShadow = true;
  // rails along the slit, brackets, weather seal, an all-sky camera bubble
  const railParts = [];
  for (const s of [-1, 1]) {
    railParts.push(tubeGeo(arcPts(s * (HW + 0.54), 0.28, Math.PI - 0.3, R + 0.06, 24), 0.045, 6, 48));
    for (const p of [0.5, 0.95, 1.4, 1.85, 2.3]) { const q = hoopPt(s * (HW + 0.54), p, R); const b = new THREE.BoxGeometry(0.16, 0.12, 0.12); b.translate(q[0], q[1], q[2]); railParts.push(b); }
  }
  railParts.push(new THREE.BoxGeometry(2 * HW + 0.3, 0.14, 0.2).translate(0, 0.07, R - 0.02));
  const camP = P3(0.0, 2.95, R), camN = new THREE.Vector3(0, Math.sin(2.95), Math.cos(2.95)), camQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), camN);
  railParts.push(new THREE.CylinderGeometry(0.2, 0.26, 0.12, 14).applyQuaternion(camQ).translate(camP[0] + camN.x * 0.04, camP[1] + camN.y * 0.04, camP[2] + camN.z * 0.04));
  const metalDome = new THREE.Mesh(mergeAll(railParts), B.mat.domeMetal); metalDome.castShadow = metalDome.receiveShadow = true;
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), kit.glass({ opacity: 0.5 })); bubble.quaternion.copy(camQ); bubble.position.set(camP[0] + camN.x * 0.1, camP[1] + camN.y * 0.1, camP[2] + camN.z * 0.1);
  const DG = makeBatch(identityFrame(env)), ri = R - TH - 0.03;                                    // amber work-light dots along the inside of the slit
  for (const sgn of [-1, 1]) for (let p = 0.42; p < PSI_E - 0.1; p += 0.27) { const q = hoopPt(sgn * (HW - 0.02), p, ri); DG.add(GM.Box(0.07, 0.05, 0.07), { p: q, color: [2.6, 1.5, 0.55], uv: 0 }); }
  const domeGlow = DG.build(B.mat.glow, { cast: false, receive: false });
  const dome = new THREE.Group(); dome.add(shellOut, shellIn, metalDome, bubble, domeGlow);
  fr.place(dome, X, SPR, Z, domeAz(0)); B.group.add(dome);

  // ───────────── telescope (own yaw group; the pitch is baked) ─────────────
  const SB = makeBatch(identityFrame(env)), mirrors = [], e = 0.22, cE = Math.cos(e), sE = Math.sin(e), HA = 3.7;
  const tp = (x, y, z) => [x, HA + y * cE + z * sE, -y * sE + z * cE];
  const cylT = (r0, r1, len, q, color, seg = 24) => SB.add(GM.Cylinder(r1, r0, len, seg), { p: tp(q[0], q[1], q[2] + len / 2), r: [Math.PI / 2 - e, 0, 0], color, uv: 0.7 });
  SB.add(GM.Cylinder(0.86, 0.9, 0.4, 28), { p: [0, 2.75, 0], color: 0x767b82 });
  SB.add(GM.Cylinder(0.7, 0.7, 0.06, 28), { p: [0, 2.97, 0], color: 0x2e3238 });
  for (const s of [-1, 1]) {
    SB.add(rbox(0.2, 1.4, 0.62, 0.04), { p: [s * 0.94, 3.62, 0], color: 0xdadddf });
    SB.add(GM.Cylinder(0.26, 0.26, 0.3, 18), { p: [s * 1.06, HA, 0], r: [0, 0, Math.PI / 2], color: 0xa6acb2 });
    SB.add(GM.Box(0.05, 0.9, 0.64), { p: [s * 1.045, 3.62, 0], color: 0xe36a14 });
  }
  cylT(0.66, 0.66, 0.75, [0, 0, -1.45], 0x565b62);                                       // mirror cell
  cylT(0.7, 0.7, 0.09, [0, 0, -0.78], 0xe36a14);                                         // orange cell ring
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; SB.add(strut(tp(Math.sin(a) * 0.67, Math.cos(a) * 0.67, -1.45), tp(Math.sin(a) * 0.67, Math.cos(a) * 0.67, -0.8), 0.018), { color: 0x7c8289, uv: 0.7 }); }
  mirrors.push(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 36).rotateX(Math.PI / 2 - e).translate(...tp(0, 0, -0.68)));  // primary
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.2, bx = Math.sin(a), by = Math.cos(a);
    SB.add(strut(tp(bx * 0.62, by * 0.62, -0.7), tp(bx * 0.54, by * 0.54, 2.5), 0.022), { color: 0xe4e6e8, uv: 0.7 });
    SB.add(strut(tp(bx * 0.62, by * 0.62, -0.7), tp(Math.sin(a + 0.8) * 0.58, Math.cos(a + 0.8) * 0.58, 0.9), 0.012), { color: 0xaeb4ba, uv: 0.7 });
  }
  for (const z of [0.55, 1.65]) SB.add(GM.Torus(0.58, 0.018, 6, 30), { p: tp(0, 0, z), r: [-e, 0, 0], color: 0xe4e6e8, uv: 0.7 });
  SB.add(GM.Torus(0.56, 0.045, 8, 32), { p: tp(0, 0, 2.5), r: [-e, 0, 0], color: 0xe4e6e8, uv: 0.7 });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; SB.add(strut(tp(0, 0, 2.5), tp(Math.sin(a) * 0.56, Math.cos(a) * 0.56, 2.5), 0.01), { color: 0x2a2d32, uv: 0.7 }); }
  cylT(0.2, 0.2, 0.17, [0, 0, 2.5], 0x2a2d32, 20);
  mirrors.push(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 24).rotateX(Math.PI / 2 - e).translate(...tp(0, 0, 2.49)));  // secondary
  SB.add(lathe([[0.6, 0], [0.64, 0], [0.64, 0.34], [0.6, 0.34], [0.6, 0]], 32), { p: tp(0, 0, 2.62), r: [Math.PI / 2 - e, 0, 0], color: 0xdadddf, uv: 0.7 });
  SB.add(rbox(0.52, 0.42, 0.56, 0.05), { p: tp(0, -0.78, -1.75), r: [-e, 0, 0], color: 0xe36a14, uv: 0.7 });                 // instrument box
  SB.add(GM.Cylinder(0.075, 0.075, 0.82, 12), { p: tp(0.7, 0.62, 0.95), r: [Math.PI / 2 - e, 0, 0], color: 0x2e3238, uv: 0.7 });   // finder
  SB.add(GM.Cylinder(0.095, 0.095, 0.08, 12), { p: tp(0.7, 0.62, 1.36), r: [Math.PI / 2 - e, 0, 0], color: 0xe36a14, uv: 0.7 });
  SB.add(tubeGeo([tp(0.4, -0.7, -1.7), tp(0.9, -0.9, -1.9), [0.95, 3.0, -0.4], [0.88, 2.98, 0.0]], 0.02, 6), { color: 0x1c1e22, uv: 0.7 });
  const SG = makeBatch(identityFrame(env));                                                       // telescope status LEDs
  for (const [q, col] of [[tp(0.25, -0.78, -1.5), [0.5, 5, 1.2]], [tp(0.15, -0.78, -1.5), [5, 0.8, 0.5]], [tp(0.05, -0.78, -1.5), [0.6, 2.4, 5]]]) SG.add(GM.Sphere(0.018, 8, 6), { p: [q[0] + 0.27, q[1], q[2] + 0.0], color: col, uv: 0 });
  const scopeGlow = SG.build(mat.glow, { cast: false, receive: false });
  const scopeBody = SB.build(mat.scopeBody);
  const scopeMirror = new THREE.Mesh(mergeAll(mirrors), mat.mirror); scopeMirror.castShadow = false; scopeMirror.receiveShadow = true;
  const scope = new THREE.Group(); scope.add(scopeBody, scopeMirror, scopeGlow); fr.place(scope, X, 0, Z, domeAz(0)); B.group.add(scope);

  B.updaters.push((dt, t) => { dome.rotation.y = fr.yaw + domeAz(t); scope.rotation.y = fr.yaw + domeAz(t - 1.4); });

  return { dome, scope, door: fr.pos(X, 1.25, front + 0.9) };
}
